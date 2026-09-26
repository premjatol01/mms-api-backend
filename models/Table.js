const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tableId: { type: String, required: true },
  number: { type: Number },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QrCode', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
