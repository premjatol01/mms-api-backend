const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureGuard');
const {
  createPublicReview,
  getPublicReviews,
  getAdminReviews,
  moderateAdminReview,
  togglePortfolioSelection
} = require('../controllers/reviews');

// ─── Public routes (Table QR Order Portal) ──────────────────────────────────
router.post('/public', createPublicReview);
router.get('/public/:subdomain', getPublicReviews);

// ─── Protected routes (Restaurant Admin) ────────────────────────────────────
router.use(protect, requireFeature('google_review'));

router.get('/', getAdminReviews);
router.patch('/:id/status', moderateAdminReview);
router.patch('/:id/toggle-portfolio', togglePortfolioSelection);

module.exports = router;
