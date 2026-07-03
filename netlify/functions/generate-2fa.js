const QRCode = require('qrcode');

exports.handler = async (event) => {
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const email = 'user@betterrenamer.app';

    const otpauth = `otpauth://totp/BetterRenamer:${email}?secret=${secret}&issuer=BetterRenamer`;
    const qrCode = await QRCode.toDataURL(otpauth);

    return {
      statusCode: 200,
      body: JSON.stringify({
        secret,
        qrCode,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
