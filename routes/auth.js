const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  loginUser,
  refreshTokenHandler,
  registerSuperAdmin,
  logoutUser,
  setupPassword,
  forgotPassword,
  resetPassword,
  savePushToken
} = require('../controllers/auth');

router.post('/login', loginUser);
router.post('/refresh-token', refreshTokenHandler);
router.post('/setup-password', setupPassword);
router.post('/register-super-admin', registerSuperAdmin);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/push-token', protect, savePushToken);

module.exports = router;
