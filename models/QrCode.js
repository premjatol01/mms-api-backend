const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
  name: { type: String },
  type: { type: String, enum: ['template', 'premium', 'custom'], default: 'template' },
  layout: { type: String },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'QRTemplate', default: null },
  status: { type: String, enum: ['available', 'assigned', 'inactive'], default: 'available' },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
  imageUrl: { type: String },
  scanUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('QrCode', qrCodeSchema);
