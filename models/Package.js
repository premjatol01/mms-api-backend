const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  duration: {
    type: String,
    enum: ['30_days', '3_months', '6_months', '1_year'],
    required: true
  },
  durationDisplay: { type: String },
  durationDays: { type: Number },
  features: [{ type: String }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
