const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getStaff,
  inviteStaff,
  resendActivation,
  updateStaff,
  toggleStaffStatus,
  deleteStaff,
} = require('../controllers/staff');

router.use(protect, roleGuard('restaurant_admin'));

router.route('/')
  .get(getStaff)
  .post(inviteStaff);

router.post('/:id/resend', resendActivation);
router.patch('/:id/status', toggleStaffStatus);

router.route('/:id')
  .put(updateStaff)
  .delete(deleteStaff);

module.exports = router;
