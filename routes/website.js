const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getWebsiteConfig,
  updateWebsiteConfig,
  publishWebsite,
  unpublishWebsite,
  saveDraft,
  getSections,
  updateSection,
  toggleSection,
  getInquiries,
  getInquiryStats,
  updateInquiryStatus,
  submitPublicInquiry,
  getFooterConfig,
  updateFooterConfig
} = require('../controllers/website');

const { createUploader } = require('../middleware/upload');
const upload = createUploader('website');

// Public Endpoint: Submit Inquiry from customer
router.post('/public/inquiry/:subdomain', submitPublicInquiry);

// All routes below require valid JWT with role restaurant_admin
router.use(protect, roleGuard('restaurant_admin'));

// Website Config & Publishing
router.route('/config')
  .get(getWebsiteConfig)
  .put(updateWebsiteConfig);

router.post('/publish', publishWebsite);
router.post('/unpublish', unpublishWebsite);
router.post('/draft', saveDraft);

// Website Sections (Reordering removed, fixed natural order)
router.route('/sections')
  .get(getSections);

router.route('/sections/:sectionId')
  .put(updateSection);

router.patch('/sections/:sectionId/toggle', toggleSection);

// Website Footer (Dedicated API)
router.route('/footer')
  .get(getFooterConfig)
  .put(updateFooterConfig);

// Image Upload
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const fileUrl = req.file.fileUrl || (req.file.path && req.file.path.startsWith('http') ? req.file.path : `/uploads/website/${req.file.filename}`);
  res.status(200).json({ success: true, url: fileUrl });
});

// Customer Inquiries
router.get('/inquiries/stats', getInquiryStats);

router.route('/inquiries')
  .get(getInquiries);

router.patch('/inquiries/:id/status', updateInquiryStatus);

module.exports = router;
