const router  = require('express').Router();
const { authenticate }  = require('../middlewares/auth');
const { authorize }     = require('../middlewares/rbac');
const { upload }        = require('../config/multer');
const {
  uploadContent,
  getMyContent,
  getContentById,
  deleteContent,
} = require('../controllers/contentController');

// All routes require auth
router.use(authenticate);

// POST /content/upload  — teacher uploads content (multipart/form-data)
router.post(
  '/upload',
  authorize('teacher'),
  upload.single('file'),
  uploadContent
);

// GET /content/my  — teacher views their own content
router.get('/my', authorize('teacher'), getMyContent);

// GET /content/:id  — teacher (own) or principal (any)
router.get('/:id', authorize('teacher', 'principal'), getContentById);

// DELETE /content/:id  — teacher deletes own pending content
router.delete('/:id', authorize('teacher'), deleteContent);

module.exports = router;
