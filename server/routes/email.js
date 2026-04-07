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

  const { to, from, subject, raw } = req.body;
  if (!from || !subject) return res.status(400).json({ error: 'Missing fields' });

  try {
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

    // tag อัตโนมัติ
    const senderTag = `from:${email}`;
    const autoTags = ['_email', senderTag, domain].filter(Boolean);

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
