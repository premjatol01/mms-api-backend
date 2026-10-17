const mongoose = require('mongoose');

const customerReviewSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  tableName: { type: String, default: '' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  customerName: { type: String, default: '' },
  customerMobile: { type: String, required: true, trim: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CustomerReview', customerReviewSchema);
