const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    roleId: {
      type: String,
      enum: ['admin', 'manager', 'kitchen', 'waiter', 'cashier', 'custom'],
      default: 'manager',
    },
    roleName: {
      type: String,
      default: 'Floor Manager',
    },
    status: {
      type: String,
      enum: ['active', 'pending_activation', 'inactive'],
      default: 'pending_activation',
    },
    permissions: [
      {
        type: String,
      },
    ],
    activationToken: {
      type: String,
      default: null,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    isOwner: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    pushTokens: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

// Unique email per restaurant
staffSchema.index({ restaurantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Staff', staffSchema);
