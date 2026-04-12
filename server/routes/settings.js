import { Router } from 'express';
import pool from '../models/db.js';

const router = Router();

const getUserId = (req) => req.headers['x-user-id'] || null;

// GET /api/settings — คืน settings ของ user
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.json({});
  try {
    const { rows } = await pool.query(
      'SELECT settings FROM users WHERE id = $1',
      [userId]
    );
    res.json(rows[0]?.settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — บันทึก settings ทั้งหมด (full replace)
router.put('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'No user id' });
  const incoming = req.body || {};
  try {
    await pool.query(
      'UPDATE users SET settings = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(incoming), userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
