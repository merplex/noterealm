import { Router } from 'express';
import pool from '../models/db.js';

const router = Router();

// List todos (optional ?since= for incremental pull, filtered by X-User-Id header)
router.get('/', async (req, res) => {
  const ORDER = `ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, due_date ASC NULLS LAST, created_at DESC`;
  try {
    const { since } = req.query;
    const userId = req.headers['x-user-id'] || null;
    let rows;
    if (userId && since) {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE (user_id=$1 OR user_id IS NULL) AND updated_at > $2 ${ORDER}`, [userId, since]));
    } else if (userId) {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE (user_id=$1 OR user_id IS NULL) ${ORDER}`, [userId]));
    } else if (since) {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE updated_at > $1 ${ORDER}`, [since]));
    } else {
      ({ rows } = await pool.query(`SELECT * FROM todos ${ORDER}`));
    }
    res.json(rows.map(mapTodo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create todo
router.post('/', async (req, res) => {
  const { id, title, note, priority, dueDate, dueTime, tags, done, linkedNoteId, source, userId } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO todos (id, user_id, title, note, priority, due_date, due_time, tags, done, linked_note_id, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, note=EXCLUDED.note, priority=EXCLUDED.priority,
         due_date=EXCLUDED.due_date, due_time=EXCLUDED.due_time, tags=EXCLUDED.tags,
         done=EXCLUDED.done, linked_note_id=EXCLUDED.linked_note_id, updated_at=NOW()
       RETURNING *`,
      [id, userId || null, title, note, priority || 'normal', dueDate || null, dueTime || null, tags || [], done || false, linkedNoteId || null, source || 'manual']
    );
    res.status(201).json(mapTodo(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update todo
router.put('/:id', async (req, res) => {
  const { title, note, priority, dueDate, dueTime, tags, done, linkedNoteId, source } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE todos SET title=$1, note=$2, priority=$3, due_date=$4, due_time=$5,
       tags=$6, done=$7, linked_note_id=$8, source=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [title, note, priority, dueDate || null, dueTime || null, tags || [], done, linkedNoteId || null, source, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapTodo(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete / restore todo
router.patch('/:id/soft-delete', async (req, res) => {
  const { deletedAt } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE todos SET deleted_at=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [deletedAt || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapTodo(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanent delete todo
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function mapTodo(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    title: row.title,
    note: row.note,
    priority: row.priority,
    dueDate: row.due_date,
    dueTime: row.due_time,
    tags: row.tags,
    done: row.done,
    linkedNoteId: row.linked_note_id,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

export default router;
