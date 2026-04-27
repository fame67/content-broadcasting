const resp = require('../utils/response');

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure → 400 with field-level error messages.
 */
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const errors = error.details.map(d => d.message);
    return resp.badRequest(res, 'Validation failed', errors);
  }
  next();
};

module.exports = { validate };
