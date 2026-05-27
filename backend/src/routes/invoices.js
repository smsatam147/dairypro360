const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

// Generate invoice number: INV-YYYY-MM-NNNN
const genInvoiceNo = async () => {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const count = await pool.query(
    `SELECT COUNT(*) FROM invoices WHERE invoice_no LIKE $1`, [`${prefix}%`]);
  return `${prefix}-${String(parseInt(count.rows[0].count)+1).padStart(4,'0')}`;
};

// GET /api/invoices
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, customer_id, page=1, limit=20 } = req.query;
    let where=[], params=[], i=1;
    if (status) { where.push(`i.status=$${i++}`); params.push(status); }
    if (customer_id) { where.push(`i.customer_id=$${i++}`); params.push(customer_id); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(+limit, (+page-1)*+limit);
    const result = await pool.query(
      `SELECT i.*, c.name as customer_name FROM invoices i
       JOIN customers c ON c.id=i.customer_id
       ${wc} ORDER BY i.invoice_date DESC LIMIT $${i++} OFFSET $${i}`, params);
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/invoices
router.post('/', authenticate, authorize('admin','finance'), async (req, res, next) => {
  try {
    const { customer_id, delivery_id, items, tax_type='CGST_SGST' } = req.body;
    if (!customer_id || !items?.length)
      return res.status(400).json({ error: 'customer_id and items are required.' });

    const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    // BUG-04 FIX: Enforce mutually exclusive tax types — never apply both CGST/SGST and IGST
    let cgst=0, sgst=0, igst=0;
    const GST_RATE = 0.05; // 5% for dairy products
    if (tax_type === 'IGST') {
      igst = subtotal * GST_RATE;
    } else {
      // Default: CGST + SGST (intra-state)
      cgst = (subtotal * GST_RATE) / 2;
      sgst = (subtotal * GST_RATE) / 2;
    }
    const total = subtotal + cgst + sgst + igst;

    const invoice_no = await genInvoiceNo();
    const due_date = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10);

    const result = await pool.query(
      `INSERT INTO invoices (invoice_no, customer_id, delivery_id, invoice_date, due_date,
       subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, status)
       VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,'Unpaid') RETURNING *`,
      [invoice_no, customer_id, delivery_id||null, due_date,
       subtotal.toFixed(2), cgst.toFixed(2), sgst.toFixed(2), igst.toFixed(2), total.toFixed(2)]);

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/invoices/:id/payment
router.put('/:id/payment', authenticate, authorize('admin','finance'), async (req, res, next) => {
  try {
    const { amount } = req.body;
    const inv = await pool.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const paid = parseFloat(inv.rows[0].paid_amount) + parseFloat(amount);
    const status = paid >= parseFloat(inv.rows[0].total_amount) ? 'Paid' : 'Partial';
    const result = await pool.query(
      `UPDATE invoices SET paid_amount=$1, status=$2 WHERE id=$3 RETURNING *`,
      [paid.toFixed(2), status, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
