const UPLOAD_FIELDS = 'id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,parents,videoMediaMetadata'
const RETRY_LIMIT = 3

async function startResumableSession(accessToken, file, parentId) {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=${UPLOAD_FIELDS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [parentId] }),
    }
  )
  if (!res.ok) throw new Error('Impossibile avviare la sessione di upload')
  const location = res.headers.get('Location')
  if (!location) throw new Error('Sessione di upload senza indirizzo di ripresa')
  return location
}

function putFromOffset(sessionUrl, file, start, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUrl, true)
    const total = file.size
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${total - 1}/${total}`)
    xhr.upload.onprogress = (e) => {
      if (onProgress) onProgress(start + e.loaded, total)
    }
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try { resolve({ done: true, file: JSON.parse(xhr.responseText) }) }
        catch { resolve({ done: true, file: null }) }
      } else if (xhr.status === 308) {
        resolve({ done: false })
      } else {
        reject(new Error(`Upload fallito (codice ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Errore di rete durante l\'upload'))
    xhr.onabort = () => reject(new Error('Upload annullato'))
    xhr.send(start > 0 ? file.slice(start) : file)
  })
}

function queryUploadedOffset(sessionUrl, total) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUrl, true)
    xhr.setRequestHeader('Content-Range', `bytes */${total}`)
    xhr.onload = () => {
      if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range')
        const match = range && /bytes=0-(\d+)/.exec(range)
        resolve(match ? parseInt(match[1], 10) + 1 : 0)
      } else if (xhr.status === 200 || xhr.status === 201) {
        resolve(total)
      } else {
        reject(new Error(`Impossibile verificare lo stato dell'upload (codice ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Errore di rete durante il controllo di stato'))
    xhr.send()
  })
}

export async function uploadFileResumable(accessToken, file, parentId, { onProgress } = {}) {
  const sessionUrl = await startResumableSession(accessToken, file, parentId)
  let offset = 0
  let attempt = 0
  while (true) {
    try {
      const result = await putFromOffset(sessionUrl, file, offset, onProgress)
      if (result.done) {
        if (onProgress) onProgress(file.size, file.size)
        return result.file
      }
      offset = await queryUploadedOffset(sessionUrl, file.size)
    } catch (err) {
      attempt += 1
      if (attempt > RETRY_LIMIT) throw err
      offset = await queryUploadedOffset(sessionUrl, file.size)
    }
  }
}
