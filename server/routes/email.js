import { Router } from 'express';
import pool from '../models/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Verify webhook secret
function verifySecret(req, res) {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// Decode MIME encoded-word (=?UTF-8?B?...?= or =?UTF-8?Q?...?=)
function decodeMimeSubject(str) {
  if (!str) return str;
  return str.replace(/=\?([^?]+)\?(B|Q)\?([^?]+)\?=/gi, (_, charset, encoding, data) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(data, 'base64').toString('utf-8');
      } else {
        // Quoted-Printable: _ → space, =XX → byte
        const decoded = data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (__, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        return Buffer.from(decoded, 'binary').toString('utf-8');
      }
    } catch { return data; }
  });
}

// Parse sender name + email from "John Smith <john@example.com>" or "john@example.com"
function parseSender(from) {
  const match = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  const name = match?.[1]?.trim() || '';
  const email = match?.[2]?.trim() || from;
  const domain = email.split('@')[1] || '';
  return { name, email, domain };
}

// Extract plain text from raw email (simple approach)
function extractBody(raw) {
  // ตัด headers ออก
  const bodyStart = raw.indexOf('\r\n\r\n') !== -1
    ? raw.indexOf('\r\n\r\n') + 4
    : raw.indexOf('\n\n') + 2;
  let body = raw.slice(bodyStart);

  // ถ้าเป็น base64 encoded
  if (body.match(/^[A-Za-z0-9+/\r\n]+=*$/m) && body.length > 100) {
    try {
      body = Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
    } catch {}
  }

  // ลบ HTML tags ถ้ามี
  body = body.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
  // ลบ quoted reply (บรรทัดที่ขึ้นต้นด้วย >)
  body = body.split('\n').filter(l => !l.trim().startsWith('>')).join('\n');

  return body.trim().slice(0, 5000); // จำกัด 5000 ตัวอักษร
}

// POST /api/webhooks/email — รับจาก Cloudflare Worker
router.post('/', async (req, res) => {
  if (!verifySecret(req, res)) return;

  const { to, from, subject: rawSubject, raw } = req.body;
  if (!from || !rawSubject) return res.status(400).json({ error: 'Missing fields' });

  try {
    const subject = decodeMimeSubject(rawSubject);
    const { name, email, domain } = parseSender(from);
    const body = raw ? extractBody(raw) : '(ไม่มีเนื้อหา)';

    // หา inbox token จาก to address เช่น notes-abc123@neverjod.com
    const toMatch = (to || '').match(/^notes-([a-z0-9]+)@/i);
    const inboxToken = toMatch?.[1] || null;

    // หา user จาก inbox token
    let userId = null;
    if (inboxToken) {
      const userRes = await pool.query(
        `SELECT id FROM users WHERE inbox_token = $1 LIMIT 1`,
        [inboxToken]
      );
      userId = userRes.rows[0]?.id || null;
    }

    // tag อัตโนมัติ: "email" + ชื่อ sender (ส่วนก่อน @)
    const senderLocal = email.split('@')[0] || email;
    const senderTag = senderLocal;
    const autoTags = ['email', senderTag].filter(Boolean);

    // timestamp สำหรับ append
    const timestamp = new Date().toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    const newBlock = `\n\n─── ${timestamp} ───\nเรื่อง: ${subject}\n${body}`;

    // หา note ที่มี senderTag อยู่แล้ว (ของ user นี้)
    let existingNote = null;
    if (userId) {
      const res2 = await pool.query(
        `SELECT * FROM notes WHERE user_id = $1 AND $2 = ANY(tags) AND deleted_at IS NULL LIMIT 1`,
        [userId, senderTag]
      );
      existingNote = res2.rows[0] || null;
    }

    if (existingNote) {
      // Append ต่อท้าย note เดิม
      await pool.query(
        `UPDATE notes SET content = content || $1, updated_at = NOW() WHERE id = $2`,
        [newBlock, existingNote.id]
      );
    } else {
      // สร้าง note ใหม่
      const displayName = name || email;
      const title = `${displayName}${domain ? ` (${domain})` : ''}`;
      await pool.query(
        `INSERT INTO notes (id, title, content, tags, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [uuidv4(), title, newBlock.trim(), autoTags, userId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Email webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
