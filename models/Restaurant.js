const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: null },
  description: { type: String },
  admin: {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, sparse: true },
    phone: { type: String, required: true }
  },
  address: {
    fullAddress: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, default: 'India' },
    pincode: { type: String }
  },
  subscription: {
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    packageName: { type: String },
    status: { type: String, enum: ['active', 'expired', 'pending'], default: 'pending' },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  // Extended Profile Fields
  tagline: String,
  shortDescription: String,
  fullDescription: String,
  restaurantType: String,
  cuisineTypes: [String],
  establishmentYear: Number,
  coverImage: String,

  contact: {
    primaryPhone: String,
    alternatePhone: String,
    email: String,
    alternateEmail: String,
    whatsapp: String,
    supportPhone: String
  },

  detailedAddress: {
    line1: String,
    line2: String,
    area: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    pincode: String,
    landmark: String
  },

  businessHours: [{
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
    isOpen: Boolean,
    slots: [{ open: String, close: String }]
  }],

  socialLinks: {
    instagram: String,
    facebook: String,
    youtube: String,
    twitter: String,
    whatsapp: String,
    other: String
  },

  website: {
    subdomain: String,
    status: { type: String, enum: ['published', 'draft', 'inactive'] }
  },

  googleReviewLink: String,

  settings: {
    isActive: Boolean,
    acceptOrders: Boolean,
    showOnPublicWebsite: Boolean
  }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
