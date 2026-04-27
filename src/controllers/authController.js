const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const Joi    = require('joi');
const { v4: uuidv4 } = require('uuid');
const db   = require('../config/db');
const resp = require('../utils/response');

// ── Validation schemas ──────────────────────────────────────────
const registerSchema = Joi.object({
  name:     Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role:     Joi.string().valid('principal', 'teacher').required(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

// ── Helpers ─────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── Controllers ─────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { name, email, password, role }
 */
const register = async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) return resp.badRequest(res, 'Validation failed', error.details.map(d => d.message));

  const { name, email, password, role } = value;

  try {
    // Check duplicate email
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return resp.badRequest(res, 'Email already registered');

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await db.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, password_hash, role]
    );

    const token = signToken({ id, email, role });
    return resp.success(res, { token, user: { id, name, email, role } }, 'Registration successful', 201);
  } catch (err) {
    console.error('[register]', err);
    return resp.error(res, 'Registration failed');
  }
};

/**
 * POST /auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) return resp.badRequest(res, 'Validation failed', error.details.map(d => d.message));

  const { email, password } = value;

  try {
    const [rows] = await db.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return resp.unauthorized(res, 'Invalid email or password');

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return resp.unauthorized(res, 'Invalid email or password');

    const token = signToken(user);
    return resp.success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 'Login successful');
  } catch (err) {
    console.error('[login]', err);
    return resp.error(res, 'Login failed');
  }
};

/**
 * GET /auth/me  (protected)
 */
const me = (req, res) =>
  resp.success(res, { user: req.user }, 'Authenticated user');

module.exports = { register, login, me };
