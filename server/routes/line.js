import { Router } from 'express';
import crypto from 'crypto';
import pool from '../models/db.js';

const router = Router();

// ตรวจสอบ signature จาก LINE
function verifySignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true; // ถ้ายังไม่ set ให้ผ่านไปก่อน
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  return hash === signature;
}

// ส่ง reply กลับ LINE (ต้องมี Channel Access Token)
async function replyMessage(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  }).catch(() => {});
}

// ดึง content รูปภาพจาก LINE
async function fetchLineImage(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

// Webhook endpoint
router.post('/', async (req, res) => {
  const signature = req.headers['x-line-signature'];

  // ต้องใช้ raw body สำหรับตรวจ signature
  if (!verifySignature(req.rawBody || JSON.stringify(req.body), signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.status(200).end(); // ตอบ LINE ทันทีก่อน (ต้องตอบภายใน 1 วิ)

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type !== 'message') continue;

    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;

    try {
      if (event.message.type === 'text') {
        const text = event.message.text;
        const lines = text.split('\n');
        const title = lines[0].slice(0, 80);
        const content = text;

        await pool.query(
          `INSERT INTO notes (id, title, content, tags, pinned, archived, images, ai_blocks, source, refs, history)
           VALUES (gen_random_uuid(), $1, $2, $3, false, false, $4, '[]', 'line', '{}', '[]')`,
          [title, content, [], []]
        );

        await replyMessage(replyToken, `บันทึกแล้ว: "${title}"`);
      } else if (event.message.type === 'image') {
        const imageData = await fetchLineImage(event.message.id);
        const images = imageData ? [imageData] : [];

        await pool.query(
          `INSERT INTO notes (id, title, content, tags, pinned, archived, images, ai_blocks, source, refs, history)
           VALUES (gen_random_uuid(), $1, $2, $3, false, false, $4, '[]', 'line', '{}', '[]')`,
          ['รูปภาพจาก LINE', '', [], images]
        );

        await replyMessage(replyToken, 'บันทึกรูปภาพแล้ว');
      }
    } catch (err) {
      console.error('LINE webhook error:', err.message);
    }
  }
});

export default router;
