const REPLICATE_MODEL_VERSION = 'b3ef194191d13140337468c916c2c5b96dd0cb06dffc032a022a31807f6a5ea8' // nightmareai/real-esrgan

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { fileId, accessToken, scale } = req.body
    if (!fileId || !accessToken) return res.status(400).json({ error: 'Missing fileId or accessToken' })

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!driveRes.ok) return res.status(driveRes.status).json({ error: 'Impossibile scaricare il file da Drive' })

    const buffer = Buffer.from(await driveRes.arrayBuffer())
    const mimeType = driveRes.headers.get('content-type') || 'image/jpeg'
    const base64 = buffer.toString('base64')

    const predictRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION,
        input: {
          image: `data:${mimeType};base64,${base64}`,
          scale: Number(scale) || 4,
          face_enhance: false,
        },
      }),
    })

    let prediction = await predictRes.json()
    if (!predictRes.ok) return res.status(predictRes.status).json({ error: prediction.detail || 'Errore Replicate' })

    const maxWaitMs = 45000
    const start = Date.now()
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
      if (Date.now() - start > maxWaitMs) return res.status(408).json({ error: 'Timeout in attesa di Replicate' })
      await new Promise(r => setTimeout(r, 1000))
      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
      })
      prediction = await pollRes.json()
    }

    if (prediction.status !== 'succeeded') {
      return res.status(400).json({ error: prediction.error || 'Elaborazione fallita' })
    }

    return res.status(200).json({ resultUrl: prediction.output })
  } catch (e) {
    console.error('[Enhance] Error:', e)
    return res.status(500).json({ error: e.message })
  }
}
