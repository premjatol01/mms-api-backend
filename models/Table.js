const mongoose = require('mongoose');
require('./QrCode');

const tableSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tableId: { type: String },
  tableNo: { type: String }, // User-configured table name/number (e.g. "Table 1")
  number: { type: Number },
  capacity: { type: Number, default: 4 }, // Number of seats (e.g. 2, 4, 6)
  section: { type: String, default: 'Main Hall' }, // e.g. 'Main Hall', 'AC Dining', 'Outdoor', 'Balcony'
  shape: { type: String, enum: ['square', 'round', 'rectangle'], default: 'square' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QrCode', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
