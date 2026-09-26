const mongoose = require('mongoose');

const cmsPageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  status: { type: String, enum: ['published', 'draft'], default: 'draft' },
  publishedAt: { type: Date, default: null },
  seoTitle: { type: String },
  metaDescription: { type: String },
  ogImage: { type: String },
  blocks: [{
    id: String,
    type: { type: String, enum: ['heading', 'paragraph', 'richtext', 'image', 'button', 'video', 'spacer', 'section'] },
    content: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('CmsPage', cmsPageSchema);
