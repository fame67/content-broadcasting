const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { authorize }    = require('../middlewares/rbac');
const {
  listAllContent,
  approveContent,
  rejectContent,
} = require('../controllers/approvalController');

// All routes: must be authenticated principal
router.use(authenticate, authorize('principal'));

// GET  /approval/content          — list all content with filters
router.get('/content', listAllContent);

// PATCH /approval/content/:id/approve
router.patch('/content/:id/approve', approveContent);

// PATCH /approval/content/:id/reject
router.patch('/content/:id/reject', rejectContent);

module.exports = router;
