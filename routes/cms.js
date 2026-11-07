const express = require('express');
const router = express.Router();

const {
  getCmsData,
  updateCmsConfig,
  publishWebsite,
  unpublishWebsite,
  updateCmsSection,
  toggleCmsSection
} = require('../controllers/cms');

// Public route to view CMS website data
router.get('/', getCmsData);

// Routes to manage CMS website configuration & sections
router.put('/config', updateCmsConfig);
router.post('/publish', publishWebsite);
router.post('/unpublish', unpublishWebsite);

router.put('/sections/:sectionId', updateCmsSection);
router.patch('/sections/:sectionId/toggle', toggleCmsSection);

module.exports = router;
