import speakeasy from 'speakeasy';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, token } = req.body;

  if (!secret || !token) return res.status(400).json({ error: 'Missing secret or token' });

  try {
    const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
    return res.status(200).json({ valid: isValid });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
