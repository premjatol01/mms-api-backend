const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { createUploader } = require('../middleware/upload');

const {
  getAdminBizGrowth,
  createBizGrowth,
  updateBizGrowth,
  deleteBizGrowth,
  toggleBizGrowthStatus,
  getRestaurantBizGrowth,
  getBizGrowthById
} = require('../controllers/bizGrowth');

const bizGrowthUploader = createUploader('biz-growth');

router.use(protect);

// -----------------------------------------------------------------------------
// Super Admin Routes
// -----------------------------------------------------------------------------
router.route('/admin')
  .get(roleGuard('super_admin'), getAdminBizGrowth)
  .post(roleGuard('super_admin'), bizGrowthUploader.single('thumbnail'), createBizGrowth);

router.route('/admin/:id')
  .put(roleGuard('super_admin'), bizGrowthUploader.single('thumbnail'), updateBizGrowth)
  .delete(roleGuard('super_admin'), deleteBizGrowth);

router.route('/admin/:id/status')
  .patch(roleGuard('super_admin'), toggleBizGrowthStatus);

// -----------------------------------------------------------------------------
// Restaurant Admin (and Super Admin) Routes
// -----------------------------------------------------------------------------
router.route('/')
  .get(getRestaurantBizGrowth);

router.route('/:id')
  .get(getBizGrowthById);

module.exports = router;
