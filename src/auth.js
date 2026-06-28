export const googleAuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  redirectUri: import.meta.env.VITE_REDIRECT_URI,
  scope: 'openid profile email https://www.googleapis.com/auth/drive',
};

export const generateAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: googleAuthConfig.clientId,
    redirect_uri: googleAuthConfig.redirectUri,
    response_type: 'code',
    scope: googleAuthConfig.scope,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const exchangeCodeForToken = async (code) => {
  const response = await fetch('/api/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) throw new Error('Token exchange failed');
  return response.json();
};

export const refreshAccessToken = async (refreshToken) => {
  const response = await fetch('/api/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) throw new Error('Token refresh failed');
  return response.json();
};
