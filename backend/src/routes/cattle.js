const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate, authorize, auditLog } = require('../middleware/auth');

// GET /api/cattle?status=&breed=&page=&limit=
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, breed, page = 1, limit = 50 } = req.query;
    let where = [], params = [], i = 1;
    if (status) { where.push(`health_status = $${i++}`); params.push(status); }
    if (breed) { where.push(`breed = $${i++}`); params.push(breed); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(+limit, (+page - 1) * +limit);
    const result = await pool.query(
      `SELECT *, DATE_PART('year', AGE(date_of_birth)) as age_years
       FROM cattle ${whereClause}
       ORDER BY cattle_tag LIMIT $${i++} OFFSET $${i}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) FROM cattle ${whereClause}`, params.slice(0,-2));
    res.json({ data: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
});

// GET /api/cattle/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT *, DATE_PART('year', AGE(date_of_birth)) as age_years FROM cattle WHERE id=$1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Cattle not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/cattle
router.post('/', authenticate, authorize('admin','farm_manager'), auditLog('CREATE','cattle'),
  async (req, res, next) => {
    try {
      const { cattle_tag, name, breed, date_of_birth, gender, notes } = req.body;
      if (!cattle_tag || !breed || !date_of_birth || !gender) {
        return res.status(400).json({ error: 'cattle_tag, breed, date_of_birth, gender are required.' });
      }
      const result = await pool.query(
        `INSERT INTO cattle (cattle_tag, name, breed, date_of_birth, gender, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [cattle_tag, name || null, breed, date_of_birth, gender, notes || null, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// PUT /api/cattle/:id
router.put('/:id', authenticate, authorize('admin','farm_manager'), auditLog('UPDATE','cattle'),
  async (req, res, next) => {
    try {
      const { name, breed, health_status, last_vaccination, next_vaccination, daily_yield_L, notes } = req.body;
      const result = await pool.query(
        `UPDATE cattle SET name=$1, breed=$2, health_status=$3, last_vaccination=$4,
         next_vaccination=$5, daily_yield_L=$6, notes=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [name, breed, health_status, last_vaccination || null, next_vaccination || null,
         daily_yield_L || 0, notes || null, req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Cattle not found' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/cattle/:id (soft delete — set status to Sold/Deceased)
router.delete('/:id', authenticate, authorize('admin'), auditLog('DELETE','cattle'),
  async (req, res, next) => {
    try {
      // BUG-03 FIX: Validate reason is a valid health_status enum value
      const validReasons = ['Sold', 'Deceased'];
      const reason = req.body?.reason && validReasons.includes(req.body.reason) ? req.body.reason : 'Sold';
      await pool.query(
        `UPDATE cattle SET health_status=$1, updated_at=NOW() WHERE id=$2`,
        [reason, req.params.id]
      );
      res.json({ message: `Cattle marked as ${reason}.` });
    } catch (err) { next(err); }
  }
);

// GET /api/cattle/:id/yield — 30-day yield trend
router.get('/:id/yield', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT log_date, shift, yield_L FROM cattle_yield_log
       WHERE cattle_id=$1 AND log_date >= NOW() - INTERVAL '30 days'
       ORDER BY log_date, shift`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/cattle/:id/yield
router.post('/:id/yield', authenticate, authorize('admin','farm_manager','collection_agent'),
  async (req, res, next) => {
    try {
      const { log_date, shift, yield_L } = req.body;
      const result = await pool.query(
        `INSERT INTO cattle_yield_log (cattle_id, log_date, shift, yield_L)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (cattle_id, log_date, shift) DO UPDATE SET yield_L=EXCLUDED.yield_L
         RETURNING *`,
        [req.params.id, log_date, shift, yield_L]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
