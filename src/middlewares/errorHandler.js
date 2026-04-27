const multer = require('multer');
const resp   = require('../utils/response');

/**
 * Global Express error handler.
 * Place LAST in middleware chain.
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[ERROR]', err.message);

  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return resp.badRequest(res, `File too large. Max size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`);
    }
    return resp.badRequest(res, err.message);
  }

  // Custom application errors with status
  if (err.status) {
    return resp.error(res, err.message, err.status);
  }

  return resp.error(res, 'Internal server error', 500);
};

module.exports = { errorHandler };
