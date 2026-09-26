const mongoose = require('mongoose');

const cmsStaticContentSchema = new mongoose.Schema({
  hero: {
    heading: String,
    subheading: String,
    description: String,
    primaryButtonText: String,
    primaryButtonLink: String,
    secondaryButtonText: String,
    secondaryButtonLink: String,
    image: String,
    status: { type: String, enum: ['published', 'draft'] }
  },
  general: {
    footerText: String,
    contactInformation: String,
    platformAddress: String,
    supportInformation: String,
    copyrightText: String,
    ctaText: String
  }
});

module.exports = mongoose.model('CmsStaticContent', cmsStaticContentSchema);
