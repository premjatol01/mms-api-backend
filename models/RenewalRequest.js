const mongoose = require('mongoose');

const renewalRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  planName: { type: String },
  amount: { type: Number },
  transactionRef: { type: String },
  screenshot: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
  requestedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RenewalRequest', renewalRequestSchema);
