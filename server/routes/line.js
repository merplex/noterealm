import { Router } from 'express';
import crypto from 'crypto';
import pool from '../models/db.js';
import { isR2Configured, uploadToR2 } from '../utils/r2.js';

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

// ดึง content ทั่วไป (file, audio) → ต้องมี R2
async function fetchLineContent(messageId, defaultMimeType = 'application/octet-stream') {
  if (!isR2Configured()) {
    console.log('[LINE] R2 not configured, skipping non-image content');
    return null;
  }
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`LINE content fetch failed: ${res.status}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || defaultMimeType;
    const mimeType = contentType.split(';')[0].trim();
    const buffer = Buffer.from(await res.arrayBuffer());
    const url = await uploadToR2(buffer, mimeType, 'line');
    console.log('[LINE] content uploaded to R2:', url);
    return { url, mimeType };
  } catch (err) {
    console.error('LINE content error:', err.message);
    return null;
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
    const buffer = Buffer.from(await res.arrayBuffer());

    // อัปโหลดไป R2 ถ้า configured — ไม่งั้น fallback เป็น base64
    if (isR2Configured()) {
      const url = await uploadToR2(buffer, mimeType);
      console.log('[LINE] image uploaded to R2:', url);
      return url;
    }

    const base64 = buffer.toString('base64');
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

  // ใช้ advisory lock per-sender เพื่อป้องกัน race condition
  // (LINE ส่งหลาย event พร้อมกัน → แต่ละ event ต้องรอกัน)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // lock key = hash ของ senderId — serialize เฉพาะ sender เดียวกัน
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [senderId]);

    // หา note ที่ active (ไม่ archived, ไม่ deleted)
    const { rows } = await client.query(
      `SELECT id, content, title, tags FROM notes WHERE source='line' AND $1=ANY(tags) AND archived=false AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
      [idTag]
    );

    // ถ้าหาด้วย _line_id tag ไม่เจอ → fallback หาด้วย title
    // (กรณี tag ถูกลบออกจาก UI โดยไม่ตั้งใจ)
    let foundRows = rows;
    if (foundRows.length === 0) {
      const { rows: byTitle } = await client.query(
        `SELECT id, content, title, tags FROM notes WHERE source='line' AND title=$1 AND archived=false AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
        [title]
      );
      if (byTitle.length > 0) {
        // restore _line_id tag กลับ
        const restoredTags = [...(byTitle[0].tags || []).filter(t => !t.startsWith('_line_id:')), idTag];
        await client.query(`UPDATE notes SET tags=$1 WHERE id=$2`, [restoredTags, byTitle[0].id]);
        byTitle[0].tags = restoredTags;
        console.log('[LINE] restored _line_id tag on note', byTitle[0].id);
        foundRows = byTitle;
      }
    }

    let result;

    if (foundRows.length > 0) {
      const note = foundRows[0];
      // เช็ค trim period จาก tag _line_trim:xxx
      const trimTag = (note.tags || []).find((t) => t.startsWith('_line_trim:'));
      const period = trimTag?.split(':')[1];

      if (period && isNoteExpired(note.content, period)) {
        // note เก่าเกิน → archive แล้วสร้างใหม่
        await client.query(`UPDATE notes SET archived=true, updated_at=NOW() WHERE id=$1`, [note.id]);
        console.log('[LINE] archived note', note.id, '(exceeded', period, ')');
        result = await createLineNote(title, [idTag, `_line_trim:${period}`], client);
      } else {
        if (note.title !== title) {
          await client.query(`UPDATE notes SET title=$1, updated_at=NOW() WHERE id=$2`, [title, note.id]);
        }
        result = note;
      }
    } else {
      // ไม่มี active note → สร้างใหม่ inherit trim tag จากโน้ตล่าสุด
      const { rows: prev } = await client.query(
        `SELECT tags FROM notes WHERE source='line' AND title=$1 ORDER BY updated_at DESC LIMIT 1`,
        [title]
      );
      const prevTrimTag = (prev[0]?.tags || []).find((t) => t.startsWith('_line_trim:'));
      const tags = [idTag];
      if (prevTrimTag) tags.push(prevTrimTag);
      result = await createLineNote(title, tags, client);
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function createLineNote(title, tags, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO notes (id, title, content, tags, pinned, archived, images, ai_blocks, source, refs, history)
     VALUES (gen_random_uuid(), $1, '', $2, false, false, '{}', '[]', 'line', '{}', '[]')
     RETURNING id, content, tags`,
    [title, tags]
  );
  return rows[0];
}

// แปลง URL ใน text เป็น <a> tag — split ก่อน escape เพื่อให้ & ใน URL ไม่ถูกแปลง
function linkify(text) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part) => {
    if (/^https?:\/\//.test(part)) {
      const safe = part.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;word-break:break-all">${safe}</a>`;
    }
    return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }).join('');
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
          parts.push(`<p style="white-space:pre-wrap;margin:4px 0">${senderLabel}${linkify(text)}</p>`);
        } else if (event.message.type === 'image') {
          const imgData = await fetchLineImage(event.message.id);
          if (imgData) {
            parts.push(`${senderLabel ? `<p style="margin:4px 0">${senderLabel}</p>` : ''}<img src="${imgData}" class="inline-note-img" style="height:1.2em;vertical-align:middle;border-radius:3px;margin:0 2px;cursor:default"/>`);
          }
        } else if (event.message.type === 'file') {
          const fileName = (event.message.fileName || 'ไฟล์แนบ').replace(/</g, '&lt;');
          const result = await fetchLineContent(event.message.id);
          if (result) {
            parts.push(`<p style="margin:4px 0">${senderLabel}📎 <a href="${result.url}" target="_blank" rel="noopener noreferrer" style="color:#0284c7">${fileName}</a></p>`);
          } else {
            parts.push(`<p style="margin:4px 0">${senderLabel}📎 ${fileName} <span style="color:#a8a29e;font-size:11px">(ต้องการ R2 เพื่อเก็บไฟล์)</span></p>`);
          }
        } else if (event.message.type === 'audio') {
          const result = await fetchLineContent(event.message.id, 'audio/m4a');
          if (result) {
            parts.push(`<p style="margin:2px 0">${senderLabel}🎵 เสียง</p><audio controls src="${result.url}" style="max-width:100%;margin:4px 0;display:block"></audio>`);
          }
        } else if (event.message.type === 'video') {
          console.log('[LINE] video skipped (too large)');
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
    res.json({ connected: true, displayName: data.displayName, pictureUrl: data.pictureUrl, basicId: data.basicId });
  } catch {
    res.json({ connected: false });
  }
});

// migrate รูป base64 ใน LINE notes ไปยัง R2
router.post('/migrate-images', async (req, res) => {
  if (!isR2Configured()) {
    return res.status(400).json({ error: 'R2 not configured' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, content FROM notes WHERE source='line' AND content LIKE '%data:image/%' AND deleted_at IS NULL`
    );

    let totalMigrated = 0;
    for (const note of rows) {
      const base64Regex = /data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)/g;
      let newContent = note.content;
      let match;
      let migrated = 0;

      while ((match = base64Regex.exec(note.content)) !== null) {
        const [full, mimeType, b64] = match;
        try {
          const buffer = Buffer.from(b64, 'base64');
          const url = await uploadToR2(buffer, mimeType);
          newContent = newContent.replace(full, url);
          migrated++;
        } catch (err) {
          console.error('[LINE] migrate image error:', err.message);
        }
      }

      if (migrated > 0) {
        await pool.query(`UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2`, [newContent, note.id]);
        totalMigrated += migrated;
        console.log('[LINE] migrated', migrated, 'image(s) in note', note.id);
      }
    }

    res.json({ migrated: totalMigrated, notes: rows.length });
  } catch (err) {
    console.error('[LINE] migrate error:', err.message);
    res.status(500).json({ error: err.message });
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
