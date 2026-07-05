import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

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
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    if (response.headers.get('content-length')) {
      res.setHeader('Content-Length', response.headers.get('content-length'))
    }
    if (!response.body) return res.end()
    await pipeline(Readable.fromWeb(response.body), res)
  } catch (e) {
    if (!res.headersSent) res.status(500).end(e.message)
    else res.destroy(e)
  }
}
