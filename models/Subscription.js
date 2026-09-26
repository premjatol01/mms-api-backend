const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String },
  adminName: { type: String },
  adminEmail: { type: String },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
  packageName: { type: String },
  duration: { type: Number },
  durationDisplay: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'expiring', 'expired', 'cancelled', 'scheduled'],
    default: 'active'
  },
  features: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
