import { Router } from 'express';
import pool from '../models/db.js';

const router = Router();

// List todos
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM todos ORDER BY
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        due_date ASC NULLS LAST,
        created_at DESC`
    );
    res.json(rows.map(mapTodo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create todo
router.post('/', async (req, res) => {
  const { id, title, note, priority, dueDate, dueTime, tags, done, linkedNoteId, source } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO todos (id, title, note, priority, due_date, due_time, tags, done, linked_note_id, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, title, note, priority || 'normal', dueDate || null, dueTime || null, tags || [], done || false, linkedNoteId || null, source || 'manual']
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
       tags=$6, done=$7, linked_note_id=$8, source=$9
       WHERE id=$10 RETURNING *`,
      [title, note, priority, dueDate || null, dueTime || null, tags || [], done, linkedNoteId || null, source, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapTodo(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete todo
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
  };
}

export default router;
