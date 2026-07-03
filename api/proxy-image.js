export default async function handler(req, res) {
  const { url, id, token } = req.query

  let fetchUrl, headers = {}

  if (id && token) {
    fetchUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`
    headers['Authorization'] = `Bearer ${token}`
  } else if (url) {
    fetchUrl = decodeURIComponent(url)
  } else {
    return res.status(400).end('Missing url or id+token')
  }

  try {
    const response = await fetch(fetchUrl, { headers })
    if (!response.ok) return res.status(response.status).end()
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(Buffer.from(buffer))
  } catch (e) {
    res.status(500).end(e.message)
  }
}
