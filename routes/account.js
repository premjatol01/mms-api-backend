const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getAccountDetails,
  updateAccountDetails,
  changePassword
} = require('../controllers/account');

// All account routes require valid JWT and restaurant_admin role
router.use(protect, roleGuard('restaurant_admin'));

router.route('/')
  .get(getAccountDetails)
  .put(updateAccountDetails);

router.put('/change-password', changePassword);

module.exports = router;
