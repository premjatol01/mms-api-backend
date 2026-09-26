const express = require('express');
const router = express.Router();
const { loginUser, registerSuperAdmin, logoutUser } = require('../controllers/auth');

router.post('/login', loginUser);
router.post('/register-super-admin', registerSuperAdmin);
router.post('/logout', logoutUser);

module.exports = router;
