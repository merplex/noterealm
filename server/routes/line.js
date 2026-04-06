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

// ดึง dates ทั้งหมดจาก content (เรียงใหม่→เก่า)
function parseDayMarkers(content) {
  return [...(content || '').matchAll(/<!-- LINE_DAY:(\d{4}-\d{2}-\d{2}) -->/g)].map((m) => m[1]);
}

// เช็คว่า note เกิน period หรือยัง (ดูจาก span ของ markers)
function isNoteExpired(content, period) {
  const dates = parseDayMarkers(content);
  if (dates.length < 1) return false;
  const newest = dates[0];
  const oldest = dates[dates.length - 1];
  const diffMs = new Date(newest) - new Date(oldest);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const maxDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
  return diffDays >= maxDays;
}

async function findOrCreateLineNote(senderId, senderName) {
  const idTag = `_line_id:${senderId}`;
  const title = `LINE: ${senderName}`;

  // หา note ที่ active (ไม่ archived, ไม่ deleted)
  const { rows } = await pool.query(
    `SELECT id, content, title, tags FROM notes WHERE source='line' AND $1=ANY(tags) AND archived=false AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [idTag]
  );

  if (rows.length > 0) {
    const note = rows[0];
    // เช็ค trim period จาก tag _line_trim:xxx
    const trimTag = (note.tags || []).find((t) => t.startsWith('_line_trim:'));
    const period = trimTag?.split(':')[1];

    if (period && isNoteExpired(note.content, period)) {
      // note เก่าเกิน → archive แล้วสร้างใหม่
      await pool.query(`UPDATE notes SET archived=true, updated_at=NOW() WHERE id=$1`, [note.id]);
      console.log('[LINE] archived note', note.id, '(exceeded', period, ')');
      // fall through เพื่อสร้าง note ใหม่ด้านล่าง — inherit trim tag
      return createLineNote(title, [idTag, `_line_trim:${period}`]);
    }

    if (note.title !== title) {
      await pool.query(`UPDATE notes SET title=$1, updated_at=NOW() WHERE id=$2`, [title, note.id]);
    }
    return note;
  }

  // ถ้ามี note เดิมที่ถูก soft-delete → undelete แทนสร้างใหม่
  const { rows: deleted } = await pool.query(
    `SELECT id, content, title, tags FROM notes WHERE source='line' AND $1=ANY(tags) AND deleted_at IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
    [idTag]
  );
  if (deleted.length > 0) {
    await pool.query(`UPDATE notes SET deleted_at=NULL, archived=false, title=$1, updated_at=NOW() WHERE id=$2`, [title, deleted[0].id]);
    return deleted[0];
  }

  // inherit trim tag จาก archived note ล่าสุด (ถ้ามี)
  const { rows: archived } = await pool.query(
    `SELECT tags FROM notes WHERE source='line' AND $1=ANY(tags) AND archived=true ORDER BY updated_at DESC LIMIT 1`,
    [idTag]
  );
  const prevTrimTag = (archived[0]?.tags || []).find((t) => t.startsWith('_line_trim:'));
  const tags = [idTag];
  if (prevTrimTag) tags.push(prevTrimTag);

  return createLineNote(title, tags);
}

async function createLineNote(title, tags) {
  const { rows } = await pool.query(
    `INSERT INTO notes (id, title, content, tags, pinned, archived, images, ai_blocks, source, refs, history)
     VALUES (gen_random_uuid(), $1, '', $2, false, false, '{}', '[]', 'line', '{}', '[]')
     RETURNING id, content, tags`,
    [title, tags]
  );
  return rows[0];
}

// วันที่ Bangkok (ISO: "2026-04-06")
function getTodayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

function getDateLabel() {
  return new Date().toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

function getTimeLabel() {
  return new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}

// แทรกข้อความเข้า note — ใช้ single atomic SQL (ไม่ต้อง transaction/FOR UPDATE)
// PostgreSQL จัดการ row-level lock ให้เอง — concurrent UPDATE จะ serialize อัตโนมัติ
async function insertToNote(noteId, bodyHtml) {
  const todayKey = getTodayKey();
  const marker = `<!-- LINE_DAY:${todayKey} -->`;
  const timeStr = getTimeLabel();
  const timeHtml = `<div style="font-size:11px;color:#b0a99f;margin:8px 0 2px">🕐 ${timeStr}</div>`;
  const entryHtml = timeHtml + bodyHtml;

  const dateStr = getDateLabel();
  const dayHeader = `<hr style="border:none;border-top:1px solid #e7e5e4;margin:12px 0"/><div style="font-size:12px;color:#a8a29e;margin-bottom:4px">📅 ${dateStr}</div>${marker}`;
  const fullEntry = dayHeader + entryHtml;

  // single UPDATE — PostgreSQL re-evaluates CASE หลังได้ row lock
  // ถ้า marker มีแล้ว (วันเดียวกัน) → แทรกหลัง marker
  // ถ้ายังไม่มี (วันใหม่) → prepend ทั้ง day header + entry
  await pool.query(
    `UPDATE notes SET content = CASE
       WHEN content LIKE '%' || $2 || '%' THEN replace(content, $2, $2 || $3)
       ELSE $4 || COALESCE(content, '')
     END, updated_at = NOW() WHERE id = $1`,
    [noteId, marker, entryHtml, fullEntry]
  );
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
      const isGroup = senderEvents[0].source?.type === 'group' || senderEvents[0].source?.type === 'room';

      for (const event of senderEvents) {
        lastReplyToken = event.replyToken;

        // ถ้าเป็น group → แสดงชื่อคนส่งแต่ละข้อความ
        let senderLabel = '';
        if (isGroup && event.source?.userId) {
          try {
            const profile = await lineGet(`/v2/bot/group/${event.source.groupId}/member/${event.source.userId}`);
            const name = profile?.displayName || 'Unknown';
            senderLabel = `<strong style="color:#78716c;font-size:12px">${name.replace(/</g, '&lt;')}</strong> `;
          } catch { /* ignore */ }
        }

        if (event.message.type === 'text') {
          const text = event.message.text;
          parts.push(`<p style="white-space:pre-wrap;margin:4px 0">${senderLabel}${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`);
        } else if (event.message.type === 'image') {
          const imgData = await fetchLineImage(event.message.id);
          if (imgData) {
            parts.push(`${senderLabel ? `<p style="margin:4px 0">${senderLabel}</p>` : ''}<img src="${imgData}" class="inline-note-img" style="height:1.2em;vertical-align:middle;border-radius:3px;margin:0 2px;cursor:default"/>`);
          }
        } else {
          console.log('[LINE] unsupported message type:', event.message.type);
        }
      }

      if (parts.length > 0) {
        await insertToNote(note.id, parts.join(''));
        console.log('[LINE] saved', parts.length, 'part(s) to note', note.id);
        await replyMessage(lastReplyToken, `บันทึกใน "${senderName}" แล้ว`);
      }
    } catch (err) {
      console.error('[LINE] webhook error:', err.message, err.stack);
    }
  }
});

// ดึง bot profile เพื่อเช็คว่า token ใช้ได้ + ชื่อ bot
router.get('/status', async (req, res) => {
  const token = getToken();
  if (!token) return res.json({ connected: false });
  try {
    const r = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.json({ connected: false });
    const data = await r.json();
    res.json({ connected: true, displayName: data.displayName, pictureUrl: data.pictureUrl });
  } catch {
    res.json({ connected: false });
  }
});

// ตั้ง period + archive notes ที่เกิน period ทันที
router.post('/trim', async (req, res) => {
  const { period } = req.body; // 'week' | 'month' | 'year'
  if (!['week', 'month', 'year'].includes(period)) {
    return res.status(400).json({ error: 'period must be week, month, or year' });
  }

  try {
    // หา LINE notes ที่ active ทั้งหมด
    const { rows } = await pool.query(`SELECT id, content, tags FROM notes WHERE source='line' AND archived=false AND deleted_at IS NULL`);
    let archivedCount = 0;

    for (const note of rows) {
      // อัปเดต _line_trim tag
      const newTags = [...(note.tags || []).filter((t) => !t.startsWith('_line_trim:')), `_line_trim:${period}`];
      await pool.query(`UPDATE notes SET tags=$1 WHERE id=$2`, [newTags, note.id]);

      // เช็คว่าเกิน period หรือยัง → archive
      if (isNoteExpired(note.content, period)) {
        await pool.query(`UPDATE notes SET archived=true, updated_at=NOW() WHERE id=$1`, [note.id]);
        archivedCount++;
        console.log('[LINE] archived note', note.id, '(exceeded', period, ')');
      }
    }

    res.json({ archived: archivedCount, period });
  } catch (err) {
    console.error('[LINE] trim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
