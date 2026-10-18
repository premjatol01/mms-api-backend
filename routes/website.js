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

// Image upload storage for website builder
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/website');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

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
  const fileUrl = `/uploads/website/${req.file.filename}`;
  res.status(200).json({ success: true, url: fileUrl });
});

// Customer Inquiries
router.get('/inquiries/stats', getInquiryStats);

router.route('/inquiries')
  .get(getInquiries);

router.patch('/inquiries/:id/status', updateInquiryStatus);

module.exports = router;
