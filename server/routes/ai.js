import { Router } from 'express';
import { getProvider } from '../providers/index.js';

const router = Router();

/**
 * POST /api/ai/chat
 * body: { provider, messages, systemPrompt, accessToken?, apiKey? }
 *
 * Route เป็น generic — ไม่รู้จัก provider ตัวไหนเลย
 * แค่ forward ไปให้ handler ใน providers/ จัดการ
 */
router.post('/chat', async (req, res) => {
  const { provider, messages, systemPrompt, accessToken, apiKey, images } = req.body;

  try {
    const handler = getProvider(provider);
    const content = await handler({ messages, systemPrompt, accessToken, apiKey, images });
    res.json({ content });
  } catch (err) {
    console.error(`AI error [${provider}]:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/ai/providers — list available providers */
router.get('/providers', (req, res) => {
  const { listProviders } = require('../providers/index.js');
  res.json({ providers: listProviders() });
});

export default router;
