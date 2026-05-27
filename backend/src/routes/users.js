const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');
const { authenticate, authorize, auditLog } = require('../middleware/auth');

// GET /api/users
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, twofa_enabled, created_at FROM users ORDER BY name`);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/users — create user (admin only)
router.post('/', authenticate, authorize('admin'), auditLog('CREATE','user'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'name, email, password, role are required.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hashed, role]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/users/:id/toggle-active
router.put('/:id/toggle-active', authenticate, authorize('admin'), auditLog('DEACTIVATE','user'),
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `UPDATE users SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1
         RETURNING id, name, email, is_active`,
        [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// GET /api/users/audit-log
router.get('/audit-log', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { page=1, limit=50 } = req.query;
    const result = await pool.query(
      `SELECT al.*, u.name as user_name, u.email FROM audit_logs al
       LEFT JOIN users u ON u.id=al.user_id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [+limit, (+page-1)*+limit]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
