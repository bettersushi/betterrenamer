const speakeasy = require('speakeasy');

exports.handler = async (event) => {
  const { secret, token } = JSON.parse(event.body);

  if (!secret || !token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing secret or token' }),
    };
  }

  try {
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

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
