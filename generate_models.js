const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');

const models = {
  'User.js': `const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['super_admin', 'restaurant_admin', 'customer'],
    required: true
  },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  mobile: { type: String },
  mobileVerified: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLoginAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
`,

  'Restaurant.js': `const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: null },
  description: { type: String },
  admin: {
    name: { type: String, required: true },
    email: { type: String, required: true },
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
`,

  'Lead.js': `const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  restaurantName: { type: String, required: true },
  address: {
    fullAddress: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    pincode: { type: String }
  },
  contactPerson: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  restaurantType: {
    type: String,
    enum: ['Fine Dining', 'Casual Dining', 'Quick Bites', 'Cafe', 'Hotel Restaurant', 'Food Truck', 'Bakery', 'Bar & Restaurant']
  },
  website: { type: String },
  stage: {
    type: String,
    enum: ['prospect', 'new_lead', 'contacted', 'qualified', 'interested', 'follow_up', 'converted', 'lost'],
    default: 'new_lead'
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  notes: { type: String },
  convertedRestaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  activity: [{
    date: { type: Date, default: Date.now },
    action: { type: String, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
`,

  'Feature.js': `const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  category: {
    type: String,
    enum: ['QR', 'Website', 'Offers', 'Reviews', 'Other'],
    required: true
  },
  description: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  displayOrder: { type: Number, default: 0 },
  packages: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Feature', featureSchema);
`,

  'Package.js': `const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  duration: {
    type: String,
    enum: ['30_days', '3_months', '6_months', '1_year'],
    required: true
  },
  durationDisplay: { type: String },
  durationDays: { type: Number },
  features: [{ type: String }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
`,

  'Subscription.js': `const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String },
  adminName: { type: String },
  adminEmail: { type: String },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
  packageName: { type: String },
  duration: { type: Number },
  durationDisplay: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'expiring', 'expired', 'cancelled', 'scheduled'],
    default: 'active'
  },
  features: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
`,

  'QrConfig.js': `const mongoose = require('mongoose');

const qrConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  assignment: {
    type: String,
    enum: ['all', 'restaurant'],
    default: 'all'
  },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('QrConfig', qrConfigSchema);
`,

  'CmsPage.js': `const mongoose = require('mongoose');

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
`,

  'CmsTestimonial.js': `const mongoose = require('mongoose');

const cmsTestimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String },
  content: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  image: { type: String },
  status: { type: String, enum: ['published', 'draft'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('CmsTestimonial', cmsTestimonialSchema);
`,

  'CmsReview.js': `const mongoose = require('mongoose');

const cmsReviewSchema = new mongoose.Schema({
  reviewer: { type: String, required: true },
  content: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  status: { type: String, enum: ['published', 'draft'], default: 'draft' },
  order: { type: Number },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CmsReview', cmsReviewSchema);
`,

  'CmsMedia.js': `const mongoose = require('mongoose');

const cmsMediaSchema = new mongoose.Schema({
  name: { type: String },
  type: { type: String },
  size: { type: Number },
  url: { type: String },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CmsMedia', cmsMediaSchema);
`,

  'CmsStaticContent.js': `const mongoose = require('mongoose');

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
`,

  'PlatformSettings.js': `const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  platformName: { type: String, required: true },
  logoUrl: { type: String },
  faviconUrl: { type: String },
  platformStatus: { type: String, enum: ['Active', 'Maintenance', 'Disabled'], default: 'Active' },
  companyName: { type: String, required: true },
  supportEmail: { type: String, required: true },
  supportPhone: { type: String },
  address: { type: String },
  websiteUrl: { type: String, required: true },
  copyrightText: { type: String },
  platformWebsiteEnabled: { type: Boolean, default: true },
  restaurantWebsiteAvailability: { type: Boolean, default: true },
  currency: { type: String, default: 'INR' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
  timeFormat: { type: String, default: '12 Hour' },
  maintenanceEnabled: { type: Boolean, default: false },
  maintenanceMessage: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
`,

  'MenuCategory.js': `const mongoose = require('mongoose');

const menuCategorySchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  itemCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('MenuCategory', menuCategorySchema);
`,

  'MenuItem.js': `const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory' },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  mrp: { type: Number },
  image: { type: String },
  foodType: { type: String, enum: ['veg', 'non-veg', 'egg'] },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  isPopular: { type: Boolean, default: false },
  isBestseller: { type: Boolean, default: false },
  prepTime: { type: Number },
  serves: { type: Number },
  calories: { type: Number },
  spiciness: { type: String, enum: ['none', 'mild', 'medium', 'spicy', 'extra-spicy'] },
  dietaryFlags: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
`,

  'Combo.js': `const mongoose = require('mongoose');

const comboSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  description: { type: String },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
  price: { type: Number, required: true },
  mrp: { type: Number },
  image: { type: String },
  badge: { type: String },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  isPopular: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Combo', comboSchema);
`,

  'Table.js': `const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tableId: { type: String, required: true },
  number: { type: Number },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QrCode', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
`,

  'QrCode.js': `const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
  name: { type: String },
  type: { type: String, enum: ['template', 'premium', 'custom'], default: 'template' },
  layout: { type: String },
  status: { type: String, enum: ['available', 'assigned', 'inactive'], default: 'available' },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
  imageUrl: { type: String },
  scanUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('QrCode', qrCodeSchema);
`,

  'Order.js': `const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
  orderNumber: { type: String },
  source: { type: String, enum: ['qr', 'manual'], default: 'qr' },
  customer: {
    mobile: { type: String, default: null }
  },
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number },
    cancelledQty: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'processing', 'served', 'cancelled'], default: 'pending' }
  }],
  subtotal: { type: Number },
  discount: { type: Number, default: 0 },
  total: { type: Number },
  status: { type: String, enum: ['pending', 'processing', 'served', 'partially_cancelled', 'cancelled'] },
  cancellations: [{
    itemId: mongoose.Schema.Types.ObjectId,
    quantity: Number,
    reason: { type: String, enum: ['customer_request', 'item_unavailable', 'kitchen_issue', 'other'] },
    comment: String,
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
`,

  'Session.js': `const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  sessionNumber: { type: String },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  paymentStatus: {
    type: String,
    enum: ['pending', 'successful', 'not_required'],
    default: 'pending'
  },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  total: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null }
});

module.exports = mongoose.model('Session', sessionSchema);
`,

  'Offer.js': `const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['repeat_order', 'order_value', 'low_traffic'],
    required: true
  },
  benefit: {
    type: { type: String, enum: ['percentage', 'flat'] },
    value: { type: Number }
  },
  validity: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  terms: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  previousOrderAmount: { type: Number },
  repeatWithinDays: { type: Number },
  minimumOrderAmount: { type: Number },
  promotionMode: { type: String, enum: ['order_value', 'menu_item'] },
  dayType: { type: String, enum: ['day_of_week', 'specific_date'] },
  dayOfWeek: { type: String },
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  menuItemName: { type: String },
  performance: {
    timesAvailed: { type: Number, default: 0 },
    totalDiscountGiven: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
`,

  'WebsiteConfig.js': `const mongoose = require('mongoose');

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
`,

  'WebsiteSection.js': `const mongoose = require('mongoose');

const websiteSectionSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  sectionId: { type: String },
  type: { type: String },
  title: { type: String },
  description: { type: String },
  enabled: { type: Boolean, default: true },
  order: { type: Number },
  content: { type: mongoose.Schema.Types.Mixed }
});

module.exports = mongoose.model('WebsiteSection', websiteSectionSchema);
`,

  'Inquiry.js': `const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  purpose: { type: String },
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new' },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inquiry', inquirySchema);
`,

  'CustomerReview.js': `const mongoose = require('mongoose');

const customerReviewSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  customerName: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomerReview', customerReviewSchema);
`,

  'RenewalRequest.js': `const mongoose = require('mongoose');

const renewalRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  planName: { type: String },
  amount: { type: Number },
  transactionRef: { type: String },
  screenshot: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
  requestedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RenewalRequest', renewalRequestSchema);
`,

  'DesignRequest.js': `const mongoose = require('mongoose');

const designRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  description: { type: String, required: true },
  attachment: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('DesignRequest', designRequestSchema);
`
};

Object.entries(models).forEach(([filename, content]) => {
  fs.writeFileSync(path.join(modelsDir, filename), content);
  console.log("Created " + filename);
});
