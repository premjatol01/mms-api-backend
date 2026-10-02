const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { createUploader } = require('../middleware/upload');

const {
  getDesignRequests,
  createDesignRequest,
  getAllDesignRequests,
  updateDesignRequestStatus
} = require('../controllers/designRequests');

// Uploader allowing documents (PDF, DOC) up to 5MB
const drUploader = createUploader('design-requests', { allowDocs: true });

router.use(protect);

// --------------------------------------------------------------------------
// Super Admin Routes
// --------------------------------------------------------------------------
router.route('/all')
  .get(roleGuard('super_admin'), getAllDesignRequests);

router.route('/:id/status')
  .put(roleGuard('super_admin'), updateDesignRequestStatus);

// --------------------------------------------------------------------------
// Restaurant Admin Routes
// --------------------------------------------------------------------------
router.route('/')
  .get(roleGuard('restaurant_admin'), getDesignRequests)
  .post(roleGuard('restaurant_admin'), drUploader.single('attachment'), createDesignRequest);

module.exports = router;
