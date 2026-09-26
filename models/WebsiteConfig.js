const mongoose = require('mongoose');

const websiteConfigSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, unique: true },
  restaurantName: { type: String },
  restaurantSlug: { type: String, unique: true },
  baseDomain: { type: String },
  description: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  websiteStatus: { type: String, enum: ['published', 'draft'], default: 'draft' },
  websiteColors: {
    primary: { type: String, default: '#f29191' },
    secondary: { type: String, default: '#b1e5e6' },
    background: { type: String, default: '#ffffff' },
    text: { type: String, default: '#1f2937' }
  },
  publishedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('WebsiteConfig', websiteConfigSchema);
