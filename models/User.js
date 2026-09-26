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
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLoginAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
