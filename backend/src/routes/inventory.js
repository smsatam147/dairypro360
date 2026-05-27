const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/inventory
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { category, warehouse } = req.query;
    let where = [], params = [], i = 1;
    if (category) { where.push(`category=$${i++}`); params.push(category); }
    if (warehouse) { where.push(`warehouse=$${i++}`); params.push(warehouse); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT *, (current_stock <= reorder_level) as needs_reorder
       FROM inventory_items ${wc} ORDER BY name`, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/inventory — create item
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { sku, name, category, unit, reorder_level, unit_cost, warehouse } = req.body;
    const result = await pool.query(
      `INSERT INTO inventory_items (sku,name,category,unit,reorder_level,unit_cost,warehouse)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sku, name, category, unit, reorder_level||0, unit_cost||0, warehouse||'Main']);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/inventory/:id/transaction — IN or OUT
router.post('/:id/transaction', authenticate, authorize('admin','farm_manager'), async (req, res, next) => {
  try {
    const { txn_type, quantity, reference, batch_no, expiry_date, notes } = req.body;
    if (!['IN','OUT','ADJUST','TRANSFER'].includes(txn_type))
      return res.status(400).json({ error: 'Invalid txn_type' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const delta = txn_type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
      const updated = await client.query(
        `UPDATE inventory_items SET current_stock = current_stock + $1 WHERE id=$2 RETURNING current_stock, reorder_level`,
        [delta, req.params.id]);
      if (!updated.rows.length) throw Object.assign(new Error('Item not found'), {statusCode: 404});

      await client.query(
        `INSERT INTO inventory_transactions (item_id, txn_type, quantity, reference, batch_no, expiry_date, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, txn_type, Math.abs(quantity), reference||null, batch_no||null, expiry_date||null, notes||null, req.user.id]);

      await client.query('COMMIT');
      res.json({ message: 'Transaction recorded', ...updated.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch (err) { next(err); }
});

module.exports = router;
