const jwt  = require('jsonwebtoken');
const db   = require('../config/db');
const resp = require('../utils/response');

/**
 * Verifies the Bearer token and attaches req.user = { id, name, email, role }
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resp.unauthorized(res, 'Authorization header missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return resp.unauthorized(res, 'Invalid or expired token');
    }

    // Verify user still exists in DB
    const [rows] = await db.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!rows.length) return resp.unauthorized(res, 'User no longer exists');

    req.user = rows[0];
    next();
  } catch (err) {
    return resp.error(res, 'Authentication error');
  }
};

module.exports = { authenticate };
