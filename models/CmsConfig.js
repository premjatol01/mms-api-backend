const mongoose = require('mongoose');

const cmsConfigSchema = new mongoose.Schema({
  websiteStatus: { type: String, enum: ['published', 'draft'], default: 'published' },
  websiteUrl: { type: String, default: 'http://localhost:3000' },
  publishedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('CmsConfig', cmsConfigSchema);
