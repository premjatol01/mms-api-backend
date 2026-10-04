const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getTables,
  createTable,
  updateTable,
  deleteTable,
  getQRCodes,
  generateQRCodes,
  deleteQRCode
} = require('../controllers/restaurantTables');

router.use(protect, roleGuard('restaurant_admin'));

// ⚠️ IMPORTANT: Specific routes MUST come before parameterised routes
// Otherwise Express matches /qr as /:id = "qr"

// QR Code Routes (defined first — before /:id)
router.route('/qr')
  .get(getQRCodes)
  .post(generateQRCodes);

router.route('/qr/:id')
  .delete(deleteQRCode);

// Table Routes
router.route('/')
  .get(getTables)
  .post(createTable);

router.route('/:id')
  .put(updateTable)
  .delete(deleteTable);

module.exports = router;
