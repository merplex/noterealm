import { Router } from 'express';

const router = Router();

/**
 * Google OAuth flow for Gemini
 *
 * 1. Frontend opens /api/oauth/google → redirects to Google consent
 * 2. Google redirects back to /api/oauth/google/callback with code
 * 3. Server exchanges code for tokens → returns to frontend via postMessage
 */

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/generative-language',
].join(' ');

// Step 1: Redirect to Google consent
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.SERVER_URL || 'http://localhost:3001'}/api/oauth/google/callback`;

  if (!clientId) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  res.redirect(url.toString());
});

// Step 2: Handle callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.SERVER_URL || 'http://localhost:3001'}/api/oauth/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return res.status(400).json({ error: tokens.error_description || tokens.error });
    }

    // Send tokens back to frontend via postMessage
    res.send(`
      <html>
      <body>
        <p>เชื่อมต่อ Google สำเร็จ กำลังกลับไปแอป...</p>
        <script>
          window.opener.postMessage({
            type: 'oauth_callback',
            provider: 'gemini',
            accessToken: ${JSON.stringify(tokens.access_token)},
            refreshToken: ${JSON.stringify(tokens.refresh_token || null)},
            expiresIn: ${tokens.expires_in || 3600}
          }, '*');
          window.close();
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Refresh token
router.post('/google/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'No refresh token' });

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenRes.json();
    res.json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
