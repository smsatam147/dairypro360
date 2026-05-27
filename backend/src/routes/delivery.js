const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/delivery/schedule?date=
router.get('/schedule', authenticate, async (req, res, next) => {
  try {
    const { date = new Date().toISOString().slice(0,10) } = req.query;
    const result = await pool.query(
      `SELECT d.*, c.name as customer_name, dr.route_name, dr.vehicle_no,
              u.name as driver_name
       FROM deliveries d
       JOIN customers c ON c.id=d.customer_id
       LEFT JOIN delivery_routes dr ON dr.id=d.route_id
       LEFT JOIN users u ON u.id=dr.driver_id
       WHERE d.scheduled_date=$1 ORDER BY dr.route_name, c.name`, [date]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/delivery
router.post('/', authenticate, authorize('admin','distribution_manager'), async (req, res, next) => {
  try {
    const { route_id, customer_id, scheduled_date, items } = req.body;
    const count = await pool.query('SELECT COUNT(*) FROM deliveries');
    const delivery_no = `DEL-${new Date().getFullYear()}-${String(parseInt(count.rows[0].count)+1).padStart(5,'0')}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const result = await pool.query(
      `INSERT INTO deliveries (delivery_no, route_id, customer_id, scheduled_date, status, otp)
       VALUES ($1,$2,$3,$4,'Scheduled',$5) RETURNING *`,
      [delivery_no, route_id||null, customer_id, scheduled_date, otp]);

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/delivery/:id/confirm — confirm delivery with OTP
router.put('/:id/confirm', authenticate, async (req, res, next) => {
  try {
    const { otp } = req.body;
    const del = await pool.query('SELECT * FROM deliveries WHERE id=$1', [req.params.id]);
    if (!del.rows.length) return res.status(404).json({ error: 'Delivery not found' });
    // BUG-05 FIX: Reject OTP if delivery already confirmed or failed
    if (['Delivered','Failed','Returned'].includes(del.rows[0].status)) {
      return res.status(400).json({ error: `Delivery already ${del.rows[0].status}. Cannot re-confirm.` });
    }
    if (del.rows[0].otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    const result = await pool.query(
      `UPDATE deliveries SET status='Delivered', delivery_time=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/delivery/:id/status
router.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status, rejection_reason, notes } = req.body;
    const result = await pool.query(
      `UPDATE deliveries SET status=$1, rejection_reason=$2, notes=$3,
       dispatch_time=CASE WHEN $1='Dispatched' THEN NOW() ELSE dispatch_time END
       WHERE id=$4 RETURNING *`,
      [status, rejection_reason||null, notes||null, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Delivery not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
