const mongoose = require('mongoose');

const renewalRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String },
  adminName: { type: String },
  adminEmail: { type: String },
  adminPhone: { type: String },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
  planName: { type: String, required: true },
  duration: { type: String },
  durationDays: { type: Number, default: 30 },
  durationDisplay: { type: String },
  amount: { type: Number, required: true },
  transactionRef: { type: String },
  screenshotUrl: { type: String },
  screenshot: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  requestType: { type: String, enum: ['renew', 'buy', 'upgrade'], default: 'renew' },
  userNote: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  reviewNote: { type: String },
  requestedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('RenewalRequest', renewalRequestSchema);
