const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

/**
 * Authenticate JWT token.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check user still exists and is active
    const result = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Role-based access control middleware factory.
 * Usage: authorize('admin', 'farm_manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

/**
 * Audit logging middleware — logs user action to audit_logs table.
 */
const auditLog = (action, entity) => async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (req.user && res.statusCode < 400) {
        await pool.query(
          `INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user.id,
            action,
            entity,
            req.params.id || null,
            req.ip,
            JSON.stringify({ method: req.method, path: req.path }),
          ]
        );
      }
    } catch (_) {
      // Non-blocking — audit failure should not break request
    }
  });
  next();
};

module.exports = { authenticate, authorize, auditLog };
