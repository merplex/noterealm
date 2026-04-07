import { Router } from 'express';
import pool from '../models/db.js';

const router = Router();

// List notes (optional ?since= for incremental pull, filtered by X-User-Id header)
router.get('/', async (req, res) => {
  try {
    const { since } = req.query;
    const userId = req.headers['x-user-id'] || null;
    let rows;
    if (userId && since) {
      ({ rows } = await pool.query(
        `SELECT * FROM notes WHERE (user_id=$1 OR user_id IS NULL) AND updated_at > $2 ORDER BY pinned DESC, updated_at DESC`,
        [userId, since]
      ));
    } else if (userId) {
      ({ rows } = await pool.query(
        `SELECT * FROM notes WHERE (user_id=$1 OR user_id IS NULL) ORDER BY pinned DESC, updated_at DESC`,
        [userId]
      ));
    } else if (since) {
      ({ rows } = await pool.query(
        `SELECT * FROM notes WHERE updated_at > $1 ORDER BY pinned DESC, updated_at DESC`,
        [since]
      ));
    } else {
      ({ rows } = await pool.query(`SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC`));
    }
    res.json(rows.map(mapNote));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single note
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapNote(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create note
router.post('/', async (req, res) => {
  const { id, title, content, tags, pinned, archived, images, aiBlocks, group, source, refs, history, userId } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notes (id, user_id, title, content, tags, pinned, archived, images, ai_blocks, "group", source, refs, history)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [id, userId || null, title, content, tags || [], pinned || false, archived || false, images || [], JSON.stringify(aiBlocks || []), group, source || 'manual', refs || [], JSON.stringify(history || [])]
    );
    res.status(201).json(mapNote(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update note
router.put('/:id', async (req, res) => {
  const { title, content, tags, pinned, archived, images, aiBlocks, group, source, refs, history, userId } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE notes SET title=$1, content=$2, tags=$3, pinned=$4, archived=$5, images=$6,
       ai_blocks=$7, "group"=$8, source=$9, refs=$10, history=$11, updated_at=NOW(),
       user_id=COALESCE(user_id, $13)
       WHERE id=$12 RETURNING *`,
      [title, content, tags || [], pinned || false, archived || false, images || [], JSON.stringify(aiBlocks || []), group, source, refs || [], JSON.stringify(history || []), req.params.id, userId || null]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapNote(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete (set/clear deleted_at)
router.patch('/:id/soft-delete', async (req, res) => {
  try {
    const { deletedAt } = req.body;
    const { rows } = await pool.query(
      `UPDATE notes SET deleted_at=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [deletedAt || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapNote(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete note
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function mapNote(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    title: row.title,
    content: row.content,
    tags: row.tags,
    pinned: row.pinned,
    archived: row.archived,
    images: row.images,
    aiBlocks: row.ai_blocks,
    group: row.group,
    source: row.source,
    refs: row.refs,
    history: row.history,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

export default router;
