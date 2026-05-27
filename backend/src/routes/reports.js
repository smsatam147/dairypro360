const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate } = require('../middleware/auth');

// GET /api/reports/dashboard — Executive KPI dashboard data
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const thisMonth = today.slice(0,7) + '-01';

    const [milkToday, revenueMonth, cattleActive, deliveriesToday, inventoryAlerts] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(quantity_L),0) as total FROM milk_collection WHERE collection_date=$1 AND quality_status='Pass'`, [today]),
      pool.query(`SELECT COALESCE(SUM(total_amount),0) as total FROM invoices WHERE invoice_date >= $1`, [thisMonth]),
      pool.query(`SELECT COUNT(*) as total FROM cattle WHERE health_status='Healthy'`),
      pool.query(`SELECT COUNT(*) as total FROM deliveries WHERE scheduled_date=$1`, [today]),
      pool.query(`SELECT COUNT(*) as total FROM inventory_items WHERE current_stock <= reorder_level`),
    ]);

    res.json({
      milk_collected_today_L: parseFloat(milkToday.rows[0].total),
      revenue_this_month_INR: parseFloat(revenueMonth.rows[0].total),
      active_healthy_cattle: parseInt(cattleActive.rows[0].total),
      deliveries_today: parseInt(deliveriesToday.rows[0].total),
      inventory_reorder_alerts: parseInt(inventoryAlerts.rows[0].total),
      generated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// GET /api/reports/collection-trend?days=30
router.get('/collection-trend', authenticate, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const result = await pool.query(
      `SELECT collection_date, SUM(quantity_L) as total_L, AVG(fat_pct) as avg_fat,
              SUM(payment_amount) as total_payment
       FROM milk_collection WHERE quality_status='Pass'
         AND collection_date >= NOW() - INTERVAL '${parseInt(days)} days'
       GROUP BY collection_date ORDER BY collection_date`, []);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/reports/farmer-contribution?from=&to=
router.get('/farmer-contribution', authenticate, async (req, res, next) => {
  try {
    const { from, to = new Date().toISOString().slice(0,10) } = req.query;
    const fromDate = from || new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10);
    const result = await pool.query(
      `SELECT fs.code, fs.name, COUNT(*) as collections,
              SUM(mc.quantity_L) as total_L, AVG(mc.fat_pct) as avg_fat,
              SUM(mc.payment_amount) as total_payment,
              COUNT(*) FILTER (WHERE mc.quality_status='Reject') as rejections
       FROM milk_collection mc
       JOIN farmer_suppliers fs ON fs.id=mc.farmer_id
       WHERE mc.collection_date BETWEEN $1 AND $2
       GROUP BY fs.code, fs.name ORDER BY total_L DESC`,
      [fromDate, to]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/reports/demand-forecast — 3-month moving average by month
router.get('/demand-forecast', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DATE_TRUNC('month', invoice_date) as month,
              SUM(total_amount) as revenue
       FROM invoices
       WHERE invoice_date >= NOW() - INTERVAL '9 months'
       GROUP BY month ORDER BY month`);

    const data = result.rows;
    const forecast = [];
    for (let i = 2; i < data.length; i++) {
      const avg = (parseFloat(data[i].revenue) + parseFloat(data[i-1].revenue) + parseFloat(data[i-2].revenue)) / 3;
      forecast.push({ month: data[i].month, actual: parseFloat(data[i].revenue), moving_avg: parseFloat(avg.toFixed(2)) });
    }
    res.json({ historical: data, forecast_moving_avg: forecast });
  } catch (err) { next(err); }
});

module.exports = router;
