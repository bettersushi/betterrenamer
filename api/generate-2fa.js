import QRCode from 'qrcode';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) secret += chars.charAt(Math.floor(Math.random() * chars.length));

    const otpauth = `otpauth://totp/BetterRenamer:user@betterrenamer.app?secret=${secret}&issuer=BetterRenamer`;
    const qrCode = await QRCode.toDataURL(otpauth);

    return res.status(200).json({ secret, qrCode });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
