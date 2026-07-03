export default async function handler(req, res) {
  const { id, token } = req.query
  if (!id || !token) return res.status(400).end('Missing id or token')

  const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`
  const headers = { Authorization: `Bearer ${token}` }

  // Forward Range header for video seeking
  if (req.headers.range) headers['Range'] = req.headers.range

  try {
    const upstream = await fetch(driveUrl, { headers })
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).end()
    }

    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type') || 'video/mp4'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', 'bytes')
    if (upstream.headers.get('content-range')) {
      res.setHeader('Content-Range', upstream.headers.get('content-range'))
    }
    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length'))
    }
    res.setHeader('Cache-Control', 'private, max-age=300')

    const buffer = await upstream.arrayBuffer()
    res.end(Buffer.from(buffer))
  } catch (e) {
    res.status(500).end(e.message)
  }
}
