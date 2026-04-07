import { Router } from 'express';
import pool from '../models/db.js';

const router = Router();

/**
 * Google OAuth flows:
 * 1. Login (profile only) — /api/oauth/google?mode=login
 * 2. Gemini (AI access) — /api/oauth/google (default)
 */

const GEMINI_SCOPES = 'https://www.googleapis.com/auth/generative-language';
const LOGIN_SCOPES = 'openid email profile';

// Step 1: Redirect to Google consent
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.SERVER_URL || 'http://localhost:3001'}/api/oauth/google/callback`;
  const mode = req.query.mode || 'gemini';
  const platform = req.query.platform || 'web'; // 'android' | 'web'

  if (!clientId) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', mode === 'login' ? LOGIN_SCOPES : GEMINI_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', `${mode}__${platform}`); // เก็บ platform ใน state

  res.redirect(url.toString());
});

// Step 2: Handle callback
router.get('/google/callback', async (req, res) => {
  const { code, state: rawState } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const [mode, platform] = (rawState || 'gemini__web').split('__');

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

    // Login mode: fetch user profile, upsert to DB, return user info
    if (mode === 'login') {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();

      // Upsert user into DB
      const result = await pool.query(
        `INSERT INTO users (id, google_id, email, name, picture, inbox_token, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, substr(md5(random()::text), 1, 10), NOW())
         ON CONFLICT (google_id) DO UPDATE
           SET email = EXCLUDED.email,
               name = EXCLUDED.name,
               picture = EXCLUDED.picture,
               updated_at = NOW()
         RETURNING id, inbox_token`,
        [profile.id, profile.email, profile.name, profile.picture || null]
      );
      const dbUserId = result.rows[0].id;
      const inboxToken = result.rows[0].inbox_token;

      const user = {
        id: dbUserId,
        googleId: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture || null,
        inboxToken,
      };

      // Android native: redirect ผ่าน deep link (browser ไม่มี window.opener)
      if (platform === 'android') {
        const encoded = encodeURIComponent(JSON.stringify(user));
        return res.redirect(`noterealm://login?user=${encoded}`);
      }

      // Web browser: postMessage + close popup
      return res.send(`
        <html>
        <body>
          <p>เข้าสู่ระบบสำเร็จ กำลังกลับไปแอป...</p>
          <script>
            window.opener.postMessage({ type: 'LOGIN_SUCCESS', user: ${JSON.stringify(user)} }, '*');
            window.close();
          </script>
        </body>
        </html>
      `);
    }

    // Gemini mode: return tokens
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

// Get inbox token by user id
router.get('/inbox-token', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(400).json({ error: 'No user id' });
  try {
    const result = await pool.query(
      `SELECT inbox_token FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ inboxToken: result.rows[0].inbox_token });
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
