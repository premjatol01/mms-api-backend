const mongoose = require('mongoose');

const customerReviewSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  customerName: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomerReview', customerReviewSchema);
