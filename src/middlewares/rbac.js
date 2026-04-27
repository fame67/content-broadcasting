const resp = require('../utils/response');

/**
 * Factory: returns middleware that only allows users with the given roles.
 * Usage: authorize('principal')  or  authorize('teacher', 'principal')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return resp.unauthorized(res);
  if (!roles.includes(req.user.role)) {
    return resp.forbidden(res, `Access restricted to: ${roles.join(', ')}`);
  }
  next();
};

module.exports = { authorize };
