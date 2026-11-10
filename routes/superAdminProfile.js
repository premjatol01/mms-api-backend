const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const {
  getSuperAdminProfile,
  updateSuperAdminProfile,
  changeSuperAdminPassword
} = require('../controllers/superAdminProfile');

router.use(protect, roleGuard('super_admin'));

router.route('/')
  .get(getSuperAdminProfile)
  .put(updateSuperAdminProfile);

router.put('/change-password', changeSuperAdminPassword);

module.exports = router;
