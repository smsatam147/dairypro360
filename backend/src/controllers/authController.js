const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const logger = require('../utils/logger');

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: `Account locked. Try again in ${mins} minute(s).`,
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      const failedLogins = (user.failed_logins || 0) + 1;
      const updates = { failed_logins: failedLogins };

      if (failedLogins >= MAX_FAILED) {
        updates.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await pool.query(
          'UPDATE users SET failed_logins=$1, locked_until=$2 WHERE id=$3',
          [failedLogins, updates.locked_until, user.id]
        );
        // TODO: send email alert to admin
        return res.status(401).json({
          error: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`,
        });
      }

      await pool.query(
        'UPDATE users SET failed_logins=$1 WHERE id=$2',
        [failedLogins, user.id]
      );
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Reset failed logins on success
    await pool.query(
      'UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1',
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info(`User ${user.email} logged in from ${req.ip}`);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        twofa_enabled: user.twofa_enabled,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/change-password
 * Authenticated. Body: { currentPassword, newPassword }
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    const user = result.rows[0];

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2', [hashed, req.user.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, twofa_enabled, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { login, changePassword, getMe };
