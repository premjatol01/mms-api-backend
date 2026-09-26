const mongoose = require('mongoose');

const cmsMediaSchema = new mongoose.Schema({
  name: { type: String },
  type: { type: String },
  size: { type: Number },
  url: { type: String },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CmsMedia', cmsMediaSchema);
