const express = require('express');
const router = express.Router();

const {
  getSubscriptions,
  getSubscriptionSummary,
  getSubscription,
  assignSubscription,
  renewSubscription,
  changePackage,
  cancelSubscription,
  reactivateSubscription
} = require('../controllers/subscriptions');

router.get('/summary', getSubscriptionSummary);

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
