const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getRestaurantAnalytics } = require('../controllers/restaurantAnalytics');

router.use(protect);

router.get('/', getRestaurantAnalytics);

module.exports = router;
