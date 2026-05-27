const { pool } = require('../utils/db');

/**
 * Calculate payment for milk collection based on fat% and base rate.
 * Rate slab per BRD v1.1:
 *   Base = INR 27/L; +INR 0.5 per 0.1% fat above 4.0%
 */
const calculatePayment = (quantityL, fatPct) => {
  const BASE_RATE = parseFloat(process.env.BASE_RATE_PER_LITRE) || 27;
  const FAT_BONUS = parseFloat(process.env.FAT_BONUS_PER_UNIT) || 0.5;
  const FAT_BASE = parseFloat(process.env.FAT_BASE) || 4.0;

  const fatDiff = (fatPct - FAT_BASE) / 0.1; // units above/below base
  const ratePerL = BASE_RATE + (FAT_BONUS * fatDiff);
  const payment = quantityL * ratePerL;
  return { ratePerL: parseFloat(ratePerL.toFixed(2)), payment: parseFloat(payment.toFixed(2)) };
};

/**
 * Validate milk quality thresholds per BRD v1.1.
 * Returns { passed: bool, reason: string|null }
 */
const validateQuality = (fatPct, snfPct, tempC) => {
  const MIN_FAT = parseFloat(process.env.MIN_FAT) || 3.0;
  const MIN_SNF = parseFloat(process.env.MIN_SNF) || 8.0;
  const MAX_TEMP = parseFloat(process.env.MAX_TEMP) || 10;

  if (fatPct < MIN_FAT) return { passed: false, reason: `Fat% ${fatPct} below minimum ${MIN_FAT}%` };
  if (snfPct < MIN_SNF) return { passed: false, reason: `SNF% ${snfPct} below minimum ${MIN_SNF}%` };
  if (tempC !== null && tempC > MAX_TEMP) return { passed: false, reason: `Temperature ${tempC}°C exceeds max ${MAX_TEMP}°C` };
  return { passed: true, reason: null };
};

/**
 * Generate unique batch ID: COL-YYYYMMDD-SSSS
 */
const generateBatchId = (date, seq) => {
  const d = new Date(date).toISOString().slice(0, 10).replace(/-/g, '');
  return `COL-${d}-${String(seq).padStart(4, '0')}`;
};

// GET /api/collection?date=&farmer_id=&status=&page=&limit=
const getCollections = async (req, res, next) => {
  try {
    const { date, farmer_id, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let i = 1;

    if (date) { where.push(`mc.collection_date = $${i++}`); params.push(date); }
    if (farmer_id) { where.push(`mc.farmer_id = $${i++}`); params.push(farmer_id); }
    if (status) { where.push(`mc.quality_status = $${i++}`); params.push(status); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT mc.*, fs.name as farmer_name, fs.code as farmer_code,
              u.name as collected_by_name
       FROM milk_collection mc
       JOIN farmer_suppliers fs ON fs.id = mc.farmer_id
       LEFT JOIN users u ON u.id = mc.collected_by
       ${whereClause}
       ORDER BY mc.collection_date DESC, mc.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM milk_collection mc ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      data: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), page: +page, limit: +limit },
    });
  } catch (err) { next(err); }
};

// POST /api/collection
const createCollection = async (req, res, next) => {
  try {
    const { farmer_id, collection_date, shift, quantity_L, fat_pct, snf_pct, clr, temperature_C } = req.body;

    // Validate required fields
    if (!farmer_id || !collection_date || !shift || !quantity_L || fat_pct === undefined || snf_pct === undefined) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Quality check
    const quality = validateQuality(+fat_pct, +snf_pct, temperature_C !== undefined ? +temperature_C : null);

    // Generate batch ID
    const countResult = await pool.query('SELECT COUNT(*) FROM milk_collection WHERE collection_date=$1', [collection_date]);
    const seq = parseInt(countResult.rows[0].count) + 1;
    const batch_id = generateBatchId(collection_date, seq);

    let ratePerL = null, payment_amount = null;
    if (quality.passed) {
      const calc = calculatePayment(+quantity_L, +fat_pct);
      ratePerL = calc.ratePerL;
      payment_amount = calc.payment;
    }

    const result = await pool.query(
      `INSERT INTO milk_collection
        (batch_id, farmer_id, collection_date, shift, quantity_L, fat_pct, snf_pct, clr,
         temperature_C, quality_status, rejection_reason, rate_per_L, payment_amount, collected_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        batch_id, farmer_id, collection_date, shift, +quantity_L,
        +fat_pct, +snf_pct, clr || null, temperature_C || null,
        quality.passed ? 'Pass' : 'Reject',
        quality.reason,
        ratePerL, payment_amount,
        req.user.id,
      ]
    );

    res.status(201).json({
      collection: result.rows[0],
      quality_check: quality,
      payment: quality.passed ? { rate_per_L: ratePerL, total: payment_amount } : null,
    });
  } catch (err) { next(err); }
};

// GET /api/collection/summary?date=&period=day|week|month
const getDailySummary = async (req, res, next) => {
  try {
    const { date = new Date().toISOString().slice(0, 10) } = req.query;

    const result = await pool.query(
      `SELECT
         fs.name as farmer_name, fs.code,
         SUM(mc.quantity_L) as total_L,
         AVG(mc.fat_pct) as avg_fat,
         AVG(mc.snf_pct) as avg_snf,
         SUM(mc.payment_amount) as total_payment,
         COUNT(*) FILTER (WHERE mc.quality_status = 'Reject') as rejections
       FROM milk_collection mc
       JOIN farmer_suppliers fs ON fs.id = mc.farmer_id
       WHERE mc.collection_date = $1 AND mc.quality_status = 'Pass'
       GROUP BY fs.name, fs.code
       ORDER BY total_L DESC`,
      [date]
    );

    const totals = await pool.query(
      `SELECT
         SUM(quantity_L) as total_L,
         SUM(payment_amount) as total_payment,
         COUNT(*) FILTER (WHERE quality_status='Reject') as rejections
       FROM milk_collection WHERE collection_date=$1`,
      [date]
    );

    res.json({ date, farmers: result.rows, totals: totals.rows[0] });
  } catch (err) { next(err); }
};

module.exports = { getCollections, createCollection, getDailySummary, calculatePayment, validateQuality };
