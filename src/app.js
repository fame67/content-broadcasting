require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');
const multer = require('multer');

const authRoutes      = require('./routes/authRoutes');
const contentRoutes   = require('./routes/contentRoutes');
const approvalRoutes  = require('./routes/approvalRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ── Security & common middleware ────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static file serving for uploads ────────────────────────────
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

// ── Health check ────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ success: true, message: 'Content Broadcasting System is running', timestamp: new Date().toISOString() })
);

// ── API Routes ──────────────────────────────────────────────────
app.use('/auth',          authRoutes);
app.use('/content/live',  broadcastRoutes);   // ⚠ mount BEFORE /content so it matches first
app.use('/content',       contentRoutes);
app.use('/approval',      approvalRoutes);

// In app.js, after all routes:
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});
// ── 404 handler ─────────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

// ── Global error handler ────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
