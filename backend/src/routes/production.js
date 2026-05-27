const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate, authorize, auditLog } = require('../middleware/auth');

// GET /api/production/batch
router.get('/batch', authenticate, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let where = [], params = [], i = 1;
    if (status) { where.push(`status=$${i++}`); params.push(status); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(+limit, (+page - 1) * +limit);
    const result = await pool.query(
      `SELECT pb.*, u.name as supervisor_name FROM production_batches pb
       LEFT JOIN users u ON u.id=pb.supervisor_id
       ${whereClause} ORDER BY pb.start_time DESC LIMIT $${i++} OFFSET $${i}`, params);
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/production/batch
router.post('/batch', authenticate, authorize('admin','farm_manager'), auditLog('CREATE','production'),
  async (req, res, next) => {
    try {
      const { product_type, start_time, input_L, notes } = req.body;
      if (!product_type || !start_time || !input_L)
        return res.status(400).json({ error: 'product_type, start_time, input_L are required.' });

      const count = await pool.query('SELECT COUNT(*) FROM production_batches');
      const batch_no = `BATCH-${new Date().getFullYear()}-${String(parseInt(count.rows[0].count)+1).padStart(4,'0')}`;

      const result = await pool.query(
        `INSERT INTO production_batches (batch_no, product_type, start_time, input_L, supervisor_id, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,'In Progress') RETURNING *`,
        [batch_no, product_type, start_time, input_L, req.user.id, notes || null]);

      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// PUT /api/production/batch/:id/complete
router.put('/batch/:id/complete', authenticate, authorize('admin','farm_manager'), async (req, res, next) => {
  try {
    const { output_kg, byproduct_kg = 0, end_time } = req.body;
    const batch = await pool.query('SELECT * FROM production_batches WHERE id=$1', [req.params.id]);
    if (!batch.rows.length) return res.status(404).json({ error: 'Batch not found' });
    const b = batch.rows[0];
    const yield_efficiency = ((output_kg / b.input_L) * 100).toFixed(2);

    const result = await pool.query(
      `UPDATE production_batches SET output_kg=$1, byproduct_kg=$2, end_time=$3,
       yield_efficiency=$4, status='Completed' WHERE id=$5 RETURNING *`,
      [output_kg, byproduct_kg, end_time || new Date(), yield_efficiency, req.params.id]);

    if (parseFloat(yield_efficiency) < 80) {
      // TODO: send alert to supervisor
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
