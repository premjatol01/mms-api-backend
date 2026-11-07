const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  maxTables: { type: Number, default: 15 },
  features: [{ type: String }],
  pricing: [
    {
      duration: { type: String, required: true },
      durationDays: { type: Number, required: true },
      durationDisplay: { type: String, required: true },
      price: { type: Number, required: true },
      isPopular: { type: Boolean, default: false }
    }
  ],
  price: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
