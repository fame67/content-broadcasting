const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { register, login, me } = require('../controllers/authController');

// POST /auth/register
router.post('/register', register);

// POST /auth/login
router.post('/login', login);

// GET  /auth/me  (protected)
router.get('/me', authenticate, me);

module.exports = router;
