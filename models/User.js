const mongoose = require('mongoose');

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
  personalAddress: {
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    area: { type: String, default: '' },
    landmark: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    pincode: { type: String, default: '' }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  refreshToken: { type: String, default: null },
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
  lastLoginAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
