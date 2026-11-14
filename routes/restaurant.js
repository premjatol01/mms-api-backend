const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getRestaurants,
  getRestaurant,
  getRestaurantPortfolio,
  createRestaurant,
  updateRestaurant,
  bulkUpdateStatus,
  toggleStatus,
  sendInvite,
  verifyTableSession
} = require('../controllers/restaurant');

const { createUploader } = require('../middleware/upload');
const upload = createUploader('restaurants');

router.route('/bulk/status')
  .patch(bulkUpdateStatus);

// Public Table Verification (Must be before /:id)
router.route('/verify-table/:subdomain/:tableId')
  .get(verifyTableSession);

// Public Portfolio Routes (Must be before /:id)
router.route('/portfolio/:subdomain')
  .get(getRestaurantPortfolio);

router.route('/by-subdomain/:subdomain')
  .get(getRestaurantPortfolio);

router.route('/')
  .get(getRestaurants)
  .post(upload.single('logo'), createRestaurant);

router.route('/:id')
  .get(getRestaurant)
  .put(upload.single('logo'), updateRestaurant);

router.route('/:id/status')
  .patch(toggleStatus);

router.route('/:id/send-invite')
  .post(sendInvite);

module.exports = router;
