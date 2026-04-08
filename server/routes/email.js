import { Router } from 'express';
import pool from '../models/db.js';
import { v4 as uuidv4 } from 'uuid';
import gemini from '../providers/gemini.js';
import { isR2Configured, uploadToR2 } from '../utils/r2.js';

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

// Parse sender name + email from various formats
function parseSender(from) {
  // Try to extract email in angle brackets first: ... <email@example.com>
  const angleBracket = from.match(/<([^>]+@[^>]+)>/);
  if (angleBracket) {
    const email = angleBracket[1].trim();
    const name = from.slice(0, from.indexOf('<')).replace(/^["'\s]+|["'\s]+$/g, '').trim();
    const domain = email.split('@')[1] || '';
    return { name: decodeMimeSubject(name), email, domain };
  }
  // Fallback: treat entire string as email or find email pattern
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+/);
  const email = emailMatch ? emailMatch[0] : from.trim();
  const domain = email.split('@')[1] || '';
  return { name: '', email, domain };
}

// Extract plain text from raw email — supports multipart MIME
function extractBody(raw, depth = 0) {
  if (!raw || depth > 3) return '(ไม่มีเนื้อหา)';

  // Find Content-Type header to detect multipart
  const headerEnd = raw.indexOf('\r\n\r\n') !== -1
    ? raw.indexOf('\r\n\r\n')
    : raw.indexOf('\n\n');
  if (headerEnd < 0) return raw.trim().slice(0, 5000) || '(ไม่มีเนื้อหา)';
  const headers = raw.slice(0, headerEnd);

  // Check for multipart boundary
  const boundaryMatch = headers.match(/boundary="?([^"\r\n;]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split('--' + boundary);

    // Find text/plain part first, then text/html
    let textPart = null;
    let htmlPart = null;
    for (const part of parts) {
      const partHeaderEnd = part.indexOf('\r\n\r\n') !== -1
        ? part.indexOf('\r\n\r\n')
        : part.indexOf('\n\n');
      if (partHeaderEnd < 0) continue;
      const partHeaders = part.slice(0, partHeaderEnd).toLowerCase();
      const partBody = part.slice(partHeaderEnd + (part.indexOf('\r\n\r\n') !== -1 ? 4 : 2));

      if (partHeaders.includes('content-type: text/plain') || partHeaders.includes('content-type:text/plain')) {
        textPart = decodePartBody(partBody, partHeaders);
      } else if (partHeaders.includes('content-type: text/html') || partHeaders.includes('content-type:text/html')) {
        htmlPart = decodePartBody(partBody, partHeaders);
      }
      // Nested multipart — recurse with depth limit
      const nestedBoundary = partHeaders.match(/boundary="?([^"\r\n;]+)"?/i);
      if (nestedBoundary && nestedBoundary[1] !== boundary) {
        const nested = extractBody(part, depth + 1);
        if (nested && nested !== '(ไม่มีเนื้อหา)') textPart = textPart || nested;
      }
    }

    let body = textPart || '';
    if (!body && htmlPart) {
      body = htmlPart.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
    }
    body = body.split('\n').filter(l => !l.trim().startsWith('>')).join('\n');
    return body.trim().slice(0, 5000) || '(ไม่มีเนื้อหา)';
  }

  // Simple single-part email
  const bodyStart = headerEnd + (raw.indexOf('\r\n\r\n') !== -1 ? 4 : 2);
  let body = raw.slice(bodyStart);

  // Check Content-Transfer-Encoding in headers
  body = decodePartBody(body, headers.toLowerCase());

  body = body.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
  body = body.split('\n').filter(l => !l.trim().startsWith('>')).join('\n');
  return body.trim().slice(0, 5000) || '(ไม่มีเนื้อหา)';
}

// Decode part body based on Content-Transfer-Encoding
function decodePartBody(body, headers) {
  try {
    if (headers.includes('content-transfer-encoding: base64') || headers.includes('content-transfer-encoding:base64')) {
      return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
    }
    if (headers.includes('content-transfer-encoding: quoted-printable') || headers.includes('content-transfer-encoding:quoted-printable')) {
      return body
        .replace(/=\r?\n/g, '') // soft line breaks
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
  } catch {}
  return body;
}

// Extract file attachments จาก raw MIME — คืน array ของ {filename, mimeType, buffer}
function extractAttachments(raw, depth = 0) {
  if (!raw || depth > 3) return [];

  const sep = raw.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
  const headerEnd = raw.indexOf(sep);
  if (headerEnd < 0) return [];
  const headers = raw.slice(0, headerEnd);

  const boundaryMatch = headers.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) return [];

  const boundary = boundaryMatch[1];
  const parts = raw.split('--' + boundary);
  const attachments = [];

  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;

    const partSep = part.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
    const partHeaderEnd = part.indexOf(partSep);
    if (partHeaderEnd < 0) continue;

    const partHeaders = part.slice(0, partHeaderEnd);
    const partHeadersLower = partHeaders.toLowerCase();
    const partBody = part.slice(partHeaderEnd + partSep.length);

    // Nested multipart → recurse
    const nestedBoundary = partHeaders.match(/boundary="?([^"\r\n;]+)"?/i);
    if (nestedBoundary && nestedBoundary[1] !== boundary) {
      attachments.push(...extractAttachments(part, depth + 1));
      continue;
    }

    // เฉพาะ attachment เท่านั้น
    if (!partHeadersLower.includes('content-disposition') ||
        !partHeadersLower.includes('attachment')) continue;

    // Content-Type
    const ctMatch = partHeaders.match(/content-type:\s*([^;\r\n]+)/i);
    const mimeType = ctMatch ? ctMatch[1].trim().toLowerCase() : 'application/octet-stream';

    // ข้าม video
    if (mimeType.startsWith('video/')) continue;

    // Filename
    const filenameMatch = partHeaders.match(/filename\*?="?([^"\r\n;]+)"?/i);
    const filename = filenameMatch ? decodeMimeSubject(filenameMatch[1].trim()) : 'attachment';

    // Decode เป็น buffer (ส่วนใหญ่ base64)
    let buffer;
    if (partHeadersLower.includes('base64')) {
      buffer = Buffer.from(partBody.replace(/\s/g, ''), 'base64');
    } else {
      buffer = Buffer.from(partBody);
    }

    attachments.push({ filename, mimeType, buffer });
  }

  return attachments;
}

// AI filter: ใช้ Gemini วิเคราะห์อีเมล
async function aiFilterEmail(subject, body, filters) {
  const tasks = [];
  if (filters.email_filter_spam) tasks.push('ถ้าเป็นอีเมลสแปมหรือข้อความขยะ ให้ตอบ skip: true');
  if (filters.email_filter_ads) tasks.push('ถ้าเป็นอีเมลโฆษณา โปรโมชัน ขายของ เสนอบริการ ให้ตอบ skip: true');
  if (filters.email_filter_summary) tasks.push('สรุปเนื้อหาอีเมลให้กระชับ 2-3 บรรทัด เก็บข้อมูลสำคัญไว้ ใส่ใน summary');

  const prompt = `วิเคราะห์อีเมลนี้:\nหัวข้อ: ${subject}\nเนื้อหา: ${body.slice(0, 2000)}\n\n${tasks.join('\n')}\n\nตอบเป็น JSON เท่านั้น: {"skip": true/false, "summary": "..." หรือ null}`;

  const result = await gemini({
    messages: [{ role: 'user', content: prompt }],
    systemPrompt: 'คุณเป็น AI กรองอีเมล ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบาย',
  });

  // Parse JSON from AI response
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { skip: false, summary: null };
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { skip: false, summary: null };
  }
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
    let userFilters = { email_filter_spam: false, email_filter_ads: false, email_filter_summary: false };
    if (inboxToken) {
      try {
        const userRes = await pool.query(
          `SELECT id, email_filter_spam, email_filter_ads, email_filter_summary FROM users WHERE inbox_token = $1 LIMIT 1`,
          [inboxToken]
        );
        if (userRes.rows[0]) {
          userId = userRes.rows[0].id;
          userFilters = userRes.rows[0];
        }
      } catch (filterErr) {
        // column อาจยังไม่มี — fallback ดึงแค่ id
        console.error('Filter columns not ready, fallback:', filterErr.message);
        const userRes = await pool.query(
          `SELECT id FROM users WHERE inbox_token = $1 LIMIT 1`,
          [inboxToken]
        );
        userId = userRes.rows[0]?.id || null;
      }
    }

    // AI filter: กรองสแปม + สรุป (ถ้า user เปิด)
    let finalBody = body;
    if (userId && (userFilters.email_filter_spam || userFilters.email_filter_ads || userFilters.email_filter_summary)) {
      try {
        const aiResult = await aiFilterEmail(subject, body, userFilters);
        if (aiResult.skip) {
          console.log('Email skipped by AI (spam):', subject);
          return res.json({ ok: true, skipped: true });
        }
        if (aiResult.summary) finalBody = aiResult.summary;
      } catch (err) {
        console.error('AI filter error (proceeding without filter):', err.message);
      }
    }

    // tag อัตโนมัติ: "email" + ชื่อ sender (ส่วนก่อน @)
    const senderLocal = email.split('@')[0] || email;
    const senderTag = senderLocal;
    const autoTags = ['email', senderTag].filter(Boolean);

    // Parse + upload attachments (ข้าม video)
    let attachmentHtml = '';
    if (raw) {
      const attachments = extractAttachments(raw);
      if (attachments.length > 0) {
        if (isR2Configured()) {
          const attParts = [];
          for (const att of attachments) {
            try {
              const url = await uploadToR2(att.buffer, att.mimeType, 'email');
              const safeName = att.filename.replace(/</g, '&lt;');
              if (att.mimeType.startsWith('image/')) {
                attParts.push(`<img src="${url}" class="inline-note-img" style="height:1.2em;vertical-align:middle;border-radius:3px;margin:0 2px;cursor:default"/>`);
              } else {
                const icon = att.mimeType === 'application/pdf' ? '📄' : '📎';
                attParts.push(`${icon} <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#0284c7">${safeName}</a>`);
              }
            } catch (err) {
              console.error('Email attachment upload error:', err.message);
            }
          }
          if (attParts.length > 0) attachmentHtml = '\n' + attParts.join('\n');
        } else {
          console.log(`Email has ${attachments.length} attachment(s) but R2 not configured — skipped`);
        }
      }
    }

    // timestamp สำหรับ append
    const timestamp = new Date().toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    const newBlock = `\n\n─── ${timestamp} ───\nเรื่อง: ${subject}\n${finalBody}${attachmentHtml}`;

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
        `UPDATE notes SET content = $1 || content, updated_at = NOW() WHERE id = $2`,
        [newBlock, existingNote.id]
      );
    } else {
      // สร้าง note ใหม่
      const newId = uuidv4();
      const displayName = name || email;
      const title = `${displayName}${domain ? ` (${domain})` : ''}`;
      await pool.query(
        `INSERT INTO notes (id, title, content, tags, user_id, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'email', NOW(), NOW())`,
        [newId, title, newBlock.trim(), autoTags, userId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Email webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
