const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/hr/employees
router.get('/employees', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM employees WHERE is_active=TRUE ORDER BY name`);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/hr/employees
router.post('/employees', authenticate, authorize('admin','hr'), async (req, res, next) => {
  try {
    const { emp_code, name, designation, department, joining_date, basic_salary, hra, special_allow, bank_account, bank_ifsc } = req.body;
    const result = await pool.query(
      `INSERT INTO employees (emp_code,name,designation,department,joining_date,basic_salary,hra,special_allow,bank_account,bank_ifsc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [emp_code, name, designation, department, joining_date, basic_salary, hra||0, special_allow||0, bank_account||null, bank_ifsc||null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/hr/payroll/run — calculate monthly payroll for all active employees
router.post('/payroll/run', authenticate, authorize('admin','hr'), async (req, res, next) => {
  try {
    const { month } = req.body; // Format: 'YYYY-MM-01'
    if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM-01).' });

    const employees = await pool.query('SELECT * FROM employees WHERE is_active=TRUE');
    const results = [];

    for (const emp of employees.rows) {
      // Count working days in month
      const workingDays = await pool.query(
        `SELECT COUNT(*) FROM attendance WHERE employee_id=$1
         AND date >= $2 AND date < $2::date + INTERVAL '1 month'`,
        [emp.id, month]);

      // BUG-01 FIX: Default to 0 if no attendance records; avoid null/NaN
      const presentDays = parseInt(workingDays.rows[0].count) || 0;
      const totalDays = new Date(new Date(month).getFullYear(),
        new Date(month).getMonth()+1, 0).getDate() || 30;

      const gross = parseFloat(emp.basic_salary) + parseFloat(emp.hra) + parseFloat(emp.special_allow);
      const pf = emp.pf_enrolled ? parseFloat(emp.basic_salary) * 0.12 : 0;
      const esi = emp.esi_enrolled && gross <= 21000 ? gross * 0.0075 : 0;
      const net = gross - pf - esi;

      const existing = await pool.query(
        'SELECT id FROM payroll WHERE employee_id=$1 AND month=$2', [emp.id, month]);

      if (existing.rows.length) {
        await pool.query(
          `UPDATE payroll SET working_days=$1, present_days=$2, gross_salary=$3,
           pf_deduction=$4, esi_deduction=$5, net_salary=$6, processed_by=$7, status='Processed'
           WHERE employee_id=$8 AND month=$9`,
          [totalDays, presentDays, gross.toFixed(2), pf.toFixed(2), esi.toFixed(2),
           net.toFixed(2), req.user.id, emp.id, month]);
      } else {
        await pool.query(
          `INSERT INTO payroll (employee_id, month, working_days, present_days, gross_salary,
           pf_deduction, esi_deduction, net_salary, processed_by, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Processed')`,
          [emp.id, month, totalDays, presentDays, gross.toFixed(2),
           pf.toFixed(2), esi.toFixed(2), net.toFixed(2), req.user.id]);
      }
      results.push({ emp_code: emp.emp_code, name: emp.name, gross: gross.toFixed(2), net: net.toFixed(2) });
    }

    res.json({ message: `Payroll processed for ${results.length} employees`, month, records: results });
  } catch (err) { next(err); }
});

// POST /api/hr/attendance
router.post('/attendance', authenticate, async (req, res, next) => {
  try {
    const { employee_id, date, status, check_in, check_out } = req.body;
    const result = await pool.query(
      `INSERT INTO attendance (employee_id, date, status, check_in, check_out)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (employee_id, date) DO UPDATE SET status=EXCLUDED.status,
       check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out RETURNING *`,
      [employee_id, date, status||'Present', check_in||null, check_out||null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
