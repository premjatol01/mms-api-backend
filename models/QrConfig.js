const mongoose = require('mongoose');

const qrConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  assignment: {
    type: String,
    enum: ['all', 'restaurant'],
    default: 'all'
  },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('QrConfig', qrConfigSchema);
