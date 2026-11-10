const mongoose = require('mongoose');

const websiteSectionSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  sectionId: { type: String },
  type: { type: String },
  title: { type: String },
  description: { type: String },
  enabled: { type: Boolean, default: true },
  order: { type: Number },
  content: { type: mongoose.Schema.Types.Mixed },
  draftContent: { type: mongoose.Schema.Types.Mixed, default: null },
  draftEnabled: { type: Boolean, default: null }
});

module.exports = mongoose.model('WebsiteSection', websiteSectionSchema);
