import { Router } from 'express';
import crypto from 'crypto';
import pool from '../models/db.js';

const router = Router();

function verifySignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  if (!secret) return true;
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  return hash === signature;
}

async function lineGet(path) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const res = await fetch(`https://api.line.me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ได้ชื่อผู้ส่งหรือชื่อกลุ่ม
async function getSenderName(event) {
  try {
    if (event.source.type === 'group') {
      const data = await lineGet(`/v2/bot/group/${event.source.groupId}/summary`);
      return data?.groupName || 'LINE Group';
    } else if (event.source.type === 'room') {
      return 'LINE Room';
    } else {
      const data = await lineGet(`/v2/bot/profile/${event.source.userId}`);
      return data?.displayName || 'LINE User';
    }
  } catch (err) {
    console.error('getSenderName error:', err.message);
    return 'LINE User';
  }
}

// ดึงรูปจาก LINE
async function fetchLineImage(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`LINE image fetch failed: ${res.status}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error('LINE image error:', err.message);
    return null;
  }
}

// ส่ง reply กลับ LINE
async function replyMessage(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch((err) => console.error('reply error:', err.message));
}

// หา note ของ sender นี้ (ถ้าไม่มีให้สร้างใหม่)
async function findOrCreateLineNote(senderName) {
  const title = `LINE: ${senderName}`;
  const { rows } = await pool.query(
    `SELECT id, content FROM notes WHERE source='line' AND title=$1 AND archived=false ORDER BY updated_at DESC LIMIT 1`,
    [title]
  );
  if (rows.length > 0) return rows[0];

  const { rows: newRows } = await pool.query(
    `INSERT INTO notes (id, title, content, tags, pinned, archived, images, ai_blocks, source, refs, history)
     VALUES (gen_random_uuid(), $1, '', '{}', false, false, '{}', '[]', 'line', '{}', '[]')
     RETURNING id, content`,
    [title]
  );
  return newRows[0];
}

// สร้าง HTML block สำหรับ entry ใหม่
function buildEntry(bodyHtml) {
  const now = new Date();
  const dateStr = now.toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Bangkok',
  });
  return `<hr style="border:none;border-top:1px solid #e7e5e4;margin:12px 0"/><div style="font-size:11px;color:#a8a29e;margin-bottom:6px">📅 ${dateStr}</div>${bodyHtml}`;
}

// Prepend entry ไว้บนสุด แล้ว update note
async function appendToNote(noteId, existingContent, entryHtml) {
  const newContent = entryHtml + (existingContent || '');
  await pool.query(
    `UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2`,
    [newContent, noteId]
  );
}

// Webhook endpoint
router.post('/', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.rawBody || JSON.stringify(req.body), signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.status(200).end(); // ตอบ LINE ก่อนเสมอ (ต้องตอบภายใน 1 วิ)

  const events = req.body.events || [];
  for (const event of events) {
    if (event.type !== 'message') continue;
    const replyToken = event.replyToken;

    try {
      const senderName = await getSenderName(event);
      const note = await findOrCreateLineNote(senderName);

      if (event.message.type === 'text') {
        const text = event.message.text;
        const bodyHtml = `<p style="white-space:pre-wrap;margin:0">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
        await appendToNote(note.id, note.content, buildEntry(bodyHtml));
        await replyMessage(replyToken, `บันทึกใน "${senderName}" แล้ว`);

      } else if (event.message.type === 'image') {
        const imgData = await fetchLineImage(event.message.id);
        if (imgData) {
          const bodyHtml = `<img src="${imgData}" style="max-width:100%;border-radius:8px;display:block"/>`;
          await appendToNote(note.id, note.content, buildEntry(bodyHtml));
          await replyMessage(replyToken, `บันทึกรูปใน "${senderName}" แล้ว`);
        } else {
          await replyMessage(replyToken, 'ดึงรูปไม่ได้ ลองใหม่อีกครั้ง');
        }
      }
    } catch (err) {
      console.error('LINE webhook error:', err.message);
    }
  }
});

export default router;
