export const handler = async (event) => {
  try {
    // Generiamo un secret base32 di 32 caratteri
    const secret = generateSecret();
    const email = 'user@betterrenamer.app'; // Placeholder

    // QR code generato tramite Google Chart API
    const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(
      `otpauth://totp/BetterRenamer:${email}?secret=${secret}&issuer=BetterRenamer`
    )}`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        secret,
        qrCode: qrCodeUrl,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}
