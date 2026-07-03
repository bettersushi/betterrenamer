export default async function handler(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).end('Missing url')
  try {
    const response = await fetch(decodeURIComponent(url))
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
