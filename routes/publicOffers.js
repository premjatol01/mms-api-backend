const express = require('express');
const router = express.Router();
const { getPublicOffers, checkOfferEligibility } = require('../controllers/offers');

// Endpoints:
// GET  /api/public/offers/:restaurantId
// POST /api/public/offers/check-eligibility
router.get('/:restaurantId', getPublicOffers);
router.post('/check-eligibility', checkOfferEligibility);

module.exports = router;
