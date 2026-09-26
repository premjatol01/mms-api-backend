const mongoose = require('mongoose');

const cmsTestimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String },
  content: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  image: { type: String },
  status: { type: String, enum: ['published', 'draft'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('CmsTestimonial', cmsTestimonialSchema);
