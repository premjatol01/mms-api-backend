const express = require('express');
const router = express.Router();
const {
  getPackages,
  getPackage,
  togglePackageStatus
} = require('../controllers/packages');

router.route('/')
  .get(getPackages);

router.route('/:id')
  .get(getPackage);

router.route('/:id/status')
  .patch(togglePackageStatus);

module.exports = router;
