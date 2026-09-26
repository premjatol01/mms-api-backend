const mongoose = require('mongoose');

const cmsReviewSchema = new mongoose.Schema({
  reviewer: { type: String, required: true },
  content: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  status: { type: String, enum: ['published', 'draft'], default: 'draft' },
  order: { type: Number },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CmsReview', cmsReviewSchema);
