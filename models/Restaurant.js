const mongoose = require('mongoose');
const { RESTAURANT_TYPES } = require('../constants/restaurantTypes');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: null },
  description: { type: String },
  phone: { type: String },
  email: { type: String, lowercase: true, trim: true },
  websiteUrl: { type: String },
  admin: {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, sparse: true },
    phone: { type: String, required: true },
    personalAddress: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      area: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
      pincode: { type: String, default: '' }
    }
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
    duration: { type: String },
    durationDisplay: { type: String },
    price: { type: Number },
    status: { type: String, enum: ['active', 'expired', 'pending', 'cancelled', 'expiring', 'scheduled'], default: 'pending' },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  // Extended Profile Fields
  tagline: String,
  shortDescription: String,
  fullDescription: String,
  restaurantType: {
    type: String,
    enum: {
      values: RESTAURANT_TYPES,
      message: '{VALUE} is not a valid restaurant type'
    },
    set: (v) => (v === '' ? undefined : v)
  },
  cuisineTypes: [String],
  establishmentYear: Number,
  coverImage: String,
  floorSections: {
    type: [String],
    default: ['Main Hall', 'AC Dining', 'Balcony', 'Outdoor', 'Rooftop', 'Lounge']
  },

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
    status: { type: String, enum: ['published', 'draft', 'inactive'] },
    url: String
  },

  googleReviewLink: String,

  settings: {
    isActive: { type: Boolean, default: true },
    acceptOrders: { type: Boolean, default: true },
    showOnPublicWebsite: { type: Boolean, default: false }
  },

  gstSettings: {
    enabled: { type: Boolean, default: false },
    percentage: { type: Number, default: 5 },
    gstNumber: { type: String, default: '' },
    chargeType: { type: String, enum: ['exclusive', 'inclusive'], default: 'exclusive' }
  },

  masterMenuSelection: {
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MasterCategory' }],
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MasterItem' }]
  },

  portalSettings: {
    waiterRequest: {
      enabled: { type: Boolean, default: true },
      cooldownMinutes: { type: Number, default: 2 },
      instructionsText: { type: String, default: 'A service captain has been notified and is heading to your table.' },
      options: [{
        id: { type: String },
        label: { type: String }
      }]
    },
    offers: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Special Table Offers & Promos' },
      subtitle: { type: String, default: 'Applicable directly to your dine-in table order at checkout' },
      bannerAnnouncement: { type: String, default: 'Show active coupon code to your server or apply directly in table session' }
    },
    wifiSharing: {
      enabled: { type: Boolean, default: false },
      ssid: { type: String, default: '' },
      password: { type: String, default: '' },
      security: { type: String, default: 'WPA2' }
    },
    followCampaign: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: 'Follow Us & Win' },
      description: { type: String, default: 'Follow our official Instagram page and show your server for a sweet treat!' }
    },
    operations: {
      acceptOrders: { type: Boolean, default: true },
      isActive: { type: Boolean, default: true },
      enableCart: { type: Boolean, default: true },
      enableFloatingCart: { type: Boolean, default: true },
      enableGames: { type: Boolean, default: true },
      geofencing: {
        enabled: { type: Boolean, default: false },
        radiusMeters: { type: Number, default: 100 }
      },
      sessionEndRedirect: {
        target: { type: String, enum: ['website', 'google_review'], default: 'website' },
        googleReviewUrl: { type: String, default: '' }
      }
    },
    tableGames: {
      enabled: { type: Boolean, default: true },
      trivia: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "Foodie Trivia Showdown" },
        tagline: { type: String, default: "Test culinary trivia with table mates" },
        status: { type: String, default: "Active" },
        timerSeconds: { type: Number, default: 15 },
        questions: [{
          id: { type: String },
          question: { type: String },
          options: [{ type: String }],
          correctIndex: { type: Number },
          explanation: { type: String }
        }]
      },
      dareSpin: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "Table Dare & Spin" },
        tagline: { type: String, default: "Spin the wheel for fun dinner challenges" },
        status: { type: String, default: "Active" },
        dares: [{
          id: { type: String },
          text: { type: String },
          color: { type: String }
        }]
      },
      ticTacToe: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "Table Tic-Tac-Toe" },
        tagline: { type: String, default: "Quick matches while waiting for your order" },
        status: { type: String, default: "Active" },
        mode: { type: String, default: "pvp" }
      }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
