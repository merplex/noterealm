import { Router } from 'express';
const router = Router();

// GET /api/og?url=... — ดึง og:image จาก URL (bypass CORS)
router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoteRealmBot/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!response.ok) return res.json({ image: null, title: null });

    // อ่านแค่ส่วน head (4KB แรก) — ไม่ต้องโหลดทั้งหน้า
    const reader = response.body.getReader();
    let html = '';
    while (html.length < 4096) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      // ถ้าเจอ </head> แล้วหยุดได้เลย
      if (html.includes('</head>')) break;
    }
    reader.cancel().catch(() => {});

    // Extract og:image
    const ogImgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    // Extract og:title หรือ <title>
    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);

    let image = ogImgMatch?.[1]?.trim() || null;
    const title = ogTitleMatch?.[1]?.trim() || null;

    // Resolve relative URL
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, url).href; } catch { image = null; }
    }

    res.json({ image, title });
  } catch (err) {
    // timeout หรือ fetch error → ไม่ error ให้ user เห็น
    res.json({ image: null, title: null });
  }
});

export default router;
