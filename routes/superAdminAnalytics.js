const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { getSuperAdminAnalytics } = require('../controllers/superAdminAnalytics');

router.use(protect);
router.use(roleGuard('super_admin'));

router.get('/', getSuperAdminAnalytics);

module.exports = router;
