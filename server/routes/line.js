import { Router } from 'express';
import crypto from 'crypto';
import pool from '../models/db.js';

const router = Router();

// ล้าง whitespace ทั้งหมด (รวม newline กลางสาย)
function getToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN?.replace(/\s/g, '') || '';
}

function verifySignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET?.replace(/\s/g, '');
  if (!secret) return true;
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  return hash === signature;
}

async function lineGet(path) {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`https://api.line.me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

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

async function fetchLineImage(messageId) {
  const token = getToken();
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

async function replyMessage(replyToken, text) {
  const token = getToken();
  if (!token || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch((err) => console.error('reply error:', err.message));
}

async function findOrCreateLineNote(senderId, senderName) {
  const idTag = `_line_id:${senderId}`;
  const title = `LINE: ${senderName}`;

  const { rows } = await pool.query(
    `SELECT id, content, title FROM notes WHERE source='line' AND $1=ANY(tags) AND archived=false ORDER BY updated_at DESC LIMIT 1`,
    [idTag]
  );

  if (rows.length > 0) {
    if (rows[0].title !== title) {
      await pool.query(`UPDATE notes SET title=$1, updated_at=NOW() WHERE id=$2`, [title, rows[0].id]);
    }
    return rows[0];
  }

  const { rows: newRows } = await pool.query(
    `INSERT INTO notes (id, title, content, tags, pinned, archived, images, ai_blocks, source, refs, history)
     VALUES (gen_random_uuid(), $1, '', $2, false, false, '{}', '[]', 'line', '{}', '[]')
     RETURNING id, content`,
    [title, [idTag]]
  );
  return newRows[0];
}

// สร้าง timestamp header + เนื้อหา (ใช้ 1 ครั้งต่อ 1 webhook call ต่อ 1 sender)
function buildEntry(bodyHtml) {
  const now = new Date();
  const dateStr = now.toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Bangkok',
  });
  return `<hr style="border:none;border-top:1px solid #e7e5e4;margin:12px 0"/><div style="font-size:11px;color:#a8a29e;margin-bottom:6px">📅 ${dateStr}</div>${bodyHtml}`;
}

async function prependToNote(noteId, existingContent, entryHtml) {
  const newContent = entryHtml + (existingContent || '');
  await pool.query(`UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2`, [newContent, noteId]);
}

// Webhook endpoint
router.post('/', async (req, res) => {
  console.log('[LINE] webhook received, events:', req.body.events?.length || 0);

  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.rawBody || JSON.stringify(req.body), signature)) {
    console.error('[LINE] signature verification FAILED');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.status(200).end();

  const allEvents = req.body.events || [];
  const events = allEvents.filter((e) => e.type === 'message');
  if (allEvents.length > 0 && events.length === 0) {
    console.log('[LINE] no message events, types:', allEvents.map((e) => e.type));
  }
  if (events.length === 0) return;

  console.log('[LINE] processing', events.length, 'message event(s)');

  // จัดกลุ่ม events ตาม sender ID — เพื่อให้ timestamp เดียวต่อ 1 webhook call
  const grouped = new Map();
  for (const event of events) {
    const src = event.source || {};
    const senderId = src.groupId || src.roomId || src.userId;
    if (!senderId) {
      console.error('[LINE] event has no senderId, source:', JSON.stringify(src));
      continue;
    }
    if (!grouped.has(senderId)) grouped.set(senderId, []);
    grouped.get(senderId).push(event);
  }

  for (const [senderId, senderEvents] of grouped) {
    try {
      console.log('[LINE] sender:', senderId, 'events:', senderEvents.length);
      const senderName = await getSenderName(senderEvents[0]);
      const note = await findOrCreateLineNote(senderId, senderName);
      console.log('[LINE] note:', note.id, 'for', senderName);

      // รวมทุก message ของ sender นี้เป็น HTML เดียว (ไม่มี timestamp แยก)
      const parts = [];
      let lastReplyToken = null;

      for (const event of senderEvents) {
        lastReplyToken = event.replyToken;

        if (event.message.type === 'text') {
          const text = event.message.text;
          parts.push(`<p style="white-space:pre-wrap;margin:4px 0">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`);
        } else if (event.message.type === 'image') {
          const imgData = await fetchLineImage(event.message.id);
          if (imgData) {
            parts.push(`<img src="${imgData}" style="max-width:100%;border-radius:8px;display:block;margin:4px 0"/>`);
          }
        } else {
          console.log('[LINE] unsupported message type:', event.message.type);
        }
      }

      if (parts.length > 0) {
        // timestamp เดียวด้านบน ตามด้วยเนื้อหาทั้งหมด
        const entryHtml = buildEntry(parts.join(''));
        await prependToNote(note.id, note.content, entryHtml);
        console.log('[LINE] saved', parts.length, 'part(s) to note', note.id);
        await replyMessage(lastReplyToken, `บันทึกใน "${senderName}" แล้ว`);
      }
    } catch (err) {
      console.error('[LINE] webhook error:', err.message, err.stack);
    }
  }
});

export default router;
