const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { proofUploader } = require('../middleware/upload');

const {
  getSubscriptionOverview,
  submitPaymentProof,
  createTicket,
  getTickets
} = require('../controllers/restaurantSubscription');

router.use(protect, roleGuard('restaurant_admin'));

router.get('/', getSubscriptionOverview);
router.post('/payment', proofUploader.single('screenshot'), submitPaymentProof);
router.post('/ticket', createTicket);
router.get('/tickets', getTickets);

module.exports = router;
