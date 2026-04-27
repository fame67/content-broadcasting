const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/gif':  'gif',
};

const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
const UPLOAD_DIR     = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname).slice(1);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and GIF files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED_MIME };
