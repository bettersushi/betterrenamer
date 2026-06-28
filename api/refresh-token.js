export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) return res.status(400).json({ error: data.error_description || 'Token refresh failed' });

    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
