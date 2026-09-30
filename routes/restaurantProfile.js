const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { restaurantUploader } = require('../middleware/upload');

const {
  getProfile,
  updateProfile,
  uploadLogo,
  removeLogo,
  uploadCover,
  removeCover,
  syncMasterMenuSelection,
} = require('../controllers/restaurantProfile');

// All routes require a valid JWT and the restaurant_admin role
router.use(protect, roleGuard('restaurant_admin'));

// Profile
router.route('/profile')
  .get(getProfile)
  .put(updateProfile);

// Logo
router.route('/profile/logo')
  .post(restaurantUploader.single('logo'), uploadLogo)
  .delete(removeLogo);

// Cover image
router.route('/profile/cover')
  .post(restaurantUploader.single('cover'), uploadCover)
  .delete(removeCover);

// Menu Selection Sync
router.route('/profile/menu-selection')
  .post(syncMasterMenuSelection);

module.exports = router;
