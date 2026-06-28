exports.handler = async (event) => {
  const { secret, token } = JSON.parse(event.body);

  if (!secret || !token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing secret or token' }),
    };
  }

  try {
    const isValid = verifyTOTP(secret, token);

    return {
      statusCode: 200,
      body: JSON.stringify({ valid: isValid }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function verifyTOTP(secret, token, window = 1) {
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000 / 30);

  for (let i = -window; i <= window; i++) {
    const counter = now + i;
    const hmac = generateHMAC(key, counter);
    const code = hmac2code(hmac);
    const paddedCode = code.toString().padStart(6, '0');

    if (paddedCode === token) {
      return true;
    }
  }

  return false;
}

function base32Decode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const val = chars.indexOf(str[i]);
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    result += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  }

  return result;
}

function generateHMAC(key, counter) {
  const crypto = require('crypto');
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; --i) {
    buf[i] = counter & 0xff;
    counter = counter >> 8;
  }
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buf);
  return hmac.digest();
}

function hmac2code(hmac) {
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return code % 1000000;
}
