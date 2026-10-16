const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  toggleOfferStatus,
  deleteOffer,
  getPublicOffers,
  checkOfferEligibility
} = require('../controllers/offers');

// ==========================================
// PUBLIC CUSTOMER ROUTES (Unauthenticated)
// ==========================================
// Reached via /api/offers/public/:restaurantId or mounted on /api/public/offers/:restaurantId
router.get('/public/:restaurantId', getPublicOffers);
router.post('/public/check-eligibility', checkOfferEligibility);

// ==========================================
// RESTAURANT ADMIN ROUTES (Protected)
// ==========================================
router.use(protect, roleGuard('restaurant_admin'));

router.route('/')
  .get(getOffers)
  .post(createOffer);

router.route('/:id')
  .get(getOfferById)
  .put(updateOffer)
  .delete(deleteOffer);

router.route('/:id/status')
  .patch(toggleOfferStatus);

module.exports = router;
