const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { createUploader } = require('../middleware/upload');

const {
  getDesignRequests,
  createDesignRequest
} = require('../controllers/designRequests');

// Uploader allowing documents (PDF, DOC) up to 5MB
const drUploader = createUploader('design-requests', { allowDocs: true });

router.use(protect, roleGuard('restaurant_admin'));

router.route('/')
  .get(getDesignRequests)
  .post(drUploader.single('attachment'), createDesignRequest);

module.exports = router;
