const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Open OAuth popup and return tokens via postMessage
 * Works for any provider that uses the /api/oauth/:provider flow
 */
export function startOAuth(provider) {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${API_BASE}/api/oauth/${provider}`,
      `oauth_${provider}`,
      'width=500,height=600,popup=yes'
    );

    if (!popup) {
      reject(new Error('Popup blocked — กรุณาอนุญาต popup'));
      return;
    }

    const handleMessage = (event) => {
      if (event.data?.type === 'oauth_callback' && event.data?.provider === provider) {
        window.removeEventListener('message', handleMessage);
        resolve({
          accessToken: event.data.accessToken,
          refreshToken: event.data.refreshToken,
          expiresIn: event.data.expiresIn,
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Timeout after 5 minutes
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      reject(new Error('OAuth timeout'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Refresh an expired OAuth token
 */
export async function refreshOAuthToken(provider, refreshToken) {
  const res = await fetch(`${API_BASE}/api/oauth/${provider}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
}

/**
 * Map provider to OAuth provider name
 * (e.g. gemini → google)
 */
const OAUTH_MAP = {
  gemini: 'google',
};

export function getOAuthProvider(aiProvider) {
  return OAUTH_MAP[aiProvider] || aiProvider;
}
