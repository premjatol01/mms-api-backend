const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  platformName: { type: String, required: true },
  logoUrl: { type: String },
  faviconUrl: { type: String },
  platformStatus: { type: String, enum: ['Active', 'Maintenance', 'Disabled'], default: 'Active' },
  companyName: { type: String },
  supportEmail: { type: String },
  supportPhone: { type: String },
  address: { type: String },
  websiteUrl: { type: String },
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
