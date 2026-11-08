const express = require('express');
const router = express.Router();
const { paymentQrUploader } = require('../middleware/upload');

const {
  getSubscriptions,
  getSubscriptionSummary,
  getSubscription,
  assignSubscription,
  renewSubscription,
  changePackage,
  cancelSubscription,
  reactivateSubscription,
  getPaymentRequests,
  reviewPaymentRequest,
  getTickets,
  updateTicket,
  getPaymentConfig,
  updatePaymentConfig
} = require('../controllers/subscriptions');

router.get('/summary', getSubscriptionSummary);

// Payment Verification Requests (Super Admin)
router.get('/payment-requests', getPaymentRequests);
router.patch('/payment-requests/:id', reviewPaymentRequest);

// Subscription Support Tickets (Super Admin)
router.get('/tickets', getTickets);
router.patch('/tickets/:id', updateTicket);

// Payment QR / UPI Configuration
router.get('/payment-config', getPaymentConfig);
router.put('/payment-config', paymentQrUploader.single('paymentQr'), updatePaymentConfig);

router.route('/')
  .get(getSubscriptions)
  .post(assignSubscription);

router.route('/:id')
  .get(getSubscription);

router.route('/:id/renew')
  .post(renewSubscription)
  .patch(renewSubscription);

router.route('/:id/package')
  .post(changePackage)
  .patch(changePackage);

router.route('/:id/cancel')
  .post(cancelSubscription)
  .patch(cancelSubscription);

router.route('/:id/reactivate')
  .post(reactivateSubscription)
  .patch(reactivateSubscription);

module.exports = router;
