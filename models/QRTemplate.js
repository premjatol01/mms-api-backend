const mongoose = require('mongoose');

const qrTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  imagePath: { type: String, required: true },
  
  // Coordinates based on percentage of image width/height (0-100)
  // This allows the template to scale responsive on frontend
  qrX: { type: Number, default: 0 },
  qrY: { type: Number, default: 0 },
  qrSize: { type: Number, default: 20 }, // Size as percentage of width
  
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('QRTemplate', qrTemplateSchema);
