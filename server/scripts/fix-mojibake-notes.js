// Repair Thai "mojibake" (double-encoded UTF-8) in already-saved note content.
//
// Root cause (fixed for new imports in server/routes/email.js decodePartBody):
// quoted-printable email bodies were decoded into a raw byte string but never
// converted back to UTF-8 before being saved — so multi-byte Thai characters
// got re-encoded a second time when written to Postgres. This script reverses
// that per <p>...</p> block for notes tagged 'email'.
//
// Usage:
//   cd server
//   DATABASE_URL="<from Railway dashboard>" node scripts/fix-mojibake-notes.js          # dry run, prints preview
//   DATABASE_URL="<from Railway dashboard>" node scripts/fix-mojibake-notes.js --apply   # writes changes

import pg from 'pg';
const { Pool } = pg;

const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL env var (from Railway dashboard) before running.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function tryFixSegment(segment) {
  if (!/[ -ÿ]{2,}/.test(segment)) return null; // no mojibake signature present

  let reDecoded;
  try {
    reDecoded = Buffer.from(segment, 'latin1').toString('utf-8');
  } catch {
    return null;
  }
  if (reDecoded.includes('�')) return null; // not a valid UTF-8 byte sequence — leave alone

  const thaiBefore = (segment.match(/[฀-๿]/g) || []).length;
  const thaiAfter = (reDecoded.match(/[฀-๿]/g) || []).length;
  if (thaiAfter <= thaiBefore) return null; // didn't actually recover Thai text — leave alone

  return reDecoded;
}

function fixContent(content) {
  let changed = false;
  const fixed = content.replace(/<p\b[^>]*>[\s\S]*?<\/p>/g, (block) => {
    const attempt = tryFixSegment(block);
    if (attempt) {
      changed = true;
      return attempt;
    }
    return block;
  });
  return { fixed, changed };
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, title, content FROM notes WHERE 'email' = ANY(tags) AND deleted_at IS NULL`
  );
  console.log(`Scanning ${rows.length} email note(s)...`);

  let touched = 0;
  for (const row of rows) {
    const { fixed, changed } = fixContent(row.content);
    if (!changed) continue;
    touched++;
    console.log(`\n--- note ${row.id} (${row.title}) ---`);
    console.log('before:', row.content.slice(0, 200).replace(/\n/g, ' '));
    console.log('after :', fixed.slice(0, 200).replace(/\n/g, ' '));
    if (APPLY) {
      await pool.query(`UPDATE notes SET content = $1 WHERE id = $2`, [fixed, row.id]);
    }
  }

  console.log(`\n${touched} note(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  if (!APPLY && touched > 0) console.log('Re-run with --apply to write the changes.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
