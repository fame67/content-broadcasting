const router      = require('express').Router();
const rateLimit   = require('express-rate-limit');
const { getLiveForTeacher, getAllLive } = require('../controllers/broadcastController');

// Rate-limit the public broadcast API  (bonus feature)
const broadcastLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 min
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

router.use(broadcastLimiter);

// GET /content/live                   — all teachers' live content
router.get('/', getAllLive);

// GET /content/live/:teacherId        — specific teacher live content
// GET /content/live/:teacherId?subject=maths
router.get('/:teacherId', getLiveForTeacher);

module.exports = router;
