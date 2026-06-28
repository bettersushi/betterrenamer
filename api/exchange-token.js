export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code } = req.body;

    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing env vars:', { clientId: !!clientId, clientSecret: !!clientSecret, redirectUri: !!redirectUri });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google error:', data);
      return res.status(400).json({ error: data.error_description || 'Token exchange failed' });
    }

    const idTokenParts = data.id_token.split('.');
    const payload = JSON.parse(Buffer.from(idTokenParts[1], 'base64').toString());

    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      email: payload.email,
    });
  } catch (error) {
    console.error('Exchange token error:', error);
    return res.status(500).json({ error: error.message });
  }
}
