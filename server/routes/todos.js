import { Router } from 'express';
import pool from '../models/db.js';

const router = Router();

// List todos (optional ?since= for incremental pull, filtered by X-User-Id header)
// Incremental pull (with ?since): ส่งทุก record รวมทั้ง tombstone → client จะลบ local ได้
// Full pull (ไม่มี ?since): ยกเว้น tombstone
router.get('/', async (req, res) => {
  const ORDER = `ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, due_date ASC NULLS LAST, created_at DESC`;
  try {
    const { since } = req.query;
    const userId = req.headers['x-user-id'] || null;
    let rows;
    if (userId && since) {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE (user_id=$1 OR user_id IS NULL) AND updated_at > $2 ${ORDER}`, [userId, since]));
    } else if (userId) {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE (user_id=$1 OR user_id IS NULL) AND permanently_deleted_at IS NULL ${ORDER}`, [userId]));
    } else if (since) {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE updated_at > $1 ${ORDER}`, [since]));
    } else {
      ({ rows } = await pool.query(`SELECT * FROM todos WHERE permanently_deleted_at IS NULL ${ORDER}`));
    }
    res.json(rows.map(mapTodo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create todo
router.post('/', async (req, res) => {
  const { id, title, note, priority, dueDate, dueTime, tags, done, linkedNoteId, source, userId,
          repeatEnabled, repeatEvery, repeatUnit, repeatStartDate, repeatParentId } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO todos (id, user_id, title, note, priority, due_date, due_time, tags, done, linked_note_id, source,
         repeat_enabled, repeat_every, repeat_unit, repeat_start_date, repeat_parent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, note=EXCLUDED.note, priority=EXCLUDED.priority,
         due_date=EXCLUDED.due_date, due_time=EXCLUDED.due_time, tags=EXCLUDED.tags,
         done=EXCLUDED.done, linked_note_id=EXCLUDED.linked_note_id,
         repeat_enabled=EXCLUDED.repeat_enabled, repeat_every=EXCLUDED.repeat_every,
         repeat_unit=EXCLUDED.repeat_unit, repeat_start_date=EXCLUDED.repeat_start_date,
         repeat_parent_id=EXCLUDED.repeat_parent_id, updated_at=NOW()
       RETURNING *`,
      [id, userId || null, title, note, priority || 'normal', dueDate || null, dueTime || null, tags || [], done || false, linkedNoteId || null, source || 'manual',
       repeatEnabled || null, repeatEvery || null, repeatUnit || null, repeatStartDate || null, repeatParentId || null]
    );
    res.status(201).json(mapTodo(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update todo
router.put('/:id', async (req, res) => {
  const { title, note, priority, dueDate, dueTime, tags, done, linkedNoteId, source, userId, deletedAt,
          repeatEnabled, repeatEvery, repeatUnit, repeatStartDate, repeatParentId } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE todos SET title=$1, note=$2, priority=$3, due_date=$4, due_time=$5,
       tags=$6, done=$7, linked_note_id=$8, source=$9, updated_at=NOW(),
       user_id=COALESCE(user_id, $11), deleted_at=$12,
       repeat_enabled=$13, repeat_every=$14, repeat_unit=$15, repeat_start_date=$16, repeat_parent_id=$17
       WHERE id=$10 RETURNING *`,
      [title, note, priority, dueDate || null, dueTime || null, tags || [], done, linkedNoteId || null, source, req.params.id, userId || null, deletedAt || null,
       repeatEnabled || null, repeatEvery || null, repeatUnit || null, repeatStartDate || null, repeatParentId || null]
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

// Permanent delete todo — tombstone แทนลบจริง
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE todos SET permanently_deleted_at=NOW(), updated_at=NOW() WHERE id=$1',
      [req.params.id]
    );
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
    repeatEnabled: row.repeat_enabled || undefined,
    repeatEvery: row.repeat_every || undefined,
    repeatUnit: row.repeat_unit || undefined,
    repeatStartDate: row.repeat_start_date || undefined,
    repeatParentId: row.repeat_parent_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    permanentlyDeletedAt: row.permanently_deleted_at || null,
  };
}

export default router;
