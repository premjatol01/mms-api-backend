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
  assignQRToTable,
  regenerateAllQRCodes,
  deleteQRCode
} = require('../controllers/restaurantTables');

router.use(protect, roleGuard('restaurant_admin'));

// ⚠️ Specific routes MUST come before parameterised /:id routes

// QR Code Routes
router.route('/qr')
  .get(getQRCodes)
  .post(generateQRCodes);

router.post('/qr/assign', assignQRToTable);          // Assign QR to table (regenerates image with real URL)
router.post('/qr/regenerate-all', regenerateAllQRCodes); // Bulk regenerate all assigned QR images

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
