const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPublicTableSession,
  placePublicOrder,
  syncCustomerToSession,
  getAdminOrders,
  getAdminSessions,
  createAdminManualOrder,
  updateOrderStatus,
  updateItemStatus,
  cancelOrderItems,
  serveAllInSession,
  markSessionPaid
} = require('../controllers/orders');

// ─── Public routes (Customer QR Order Portal) ──────────────────────────────
router.get('/public/session/:subdomain/:tableId', getPublicTableSession);
router.post('/public/place-order', placePublicOrder);
router.post('/public/session/sync-customer', syncCustomerToSession);

// ─── Protected routes (Restaurant Admin) ──────────────────────────────────
router.use(protect);

router.get('/', getAdminOrders);
router.get('/sessions', getAdminSessions);
router.post('/manual', createAdminManualOrder);
router.put('/:id/status', updateOrderStatus);
router.put('/:id/items/:itemId/status', updateItemStatus);
router.post('/:id/cancel', cancelOrderItems);
router.post('/sessions/:sessionId/serve-all', serveAllInSession);
router.post('/sessions/:sessionId/pay', markSessionPaid);

module.exports = router;
