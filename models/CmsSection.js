const mongoose = require('mongoose');

const cmsSectionSchema = new mongoose.Schema({
  sectionId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  content: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('CmsSection', cmsSectionSchema);
