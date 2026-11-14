const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ['super_admin', 'restaurant'],
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
      index: true,
    },
    targetRoles: [
      {
        type: String,
        enum: ['admin', 'manager', 'kitchen', 'cashier', 'waiter', 'all'],
        default: ['all'],
      },
    ],
    category: {
      type: String,
      enum: [
        'lead',
        'subscription',
        'order',
        'biz_growth',
        'system',
        'waiter_call',
        'ticket',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actionUrl: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast query
notificationSchema.index({ recipientType: 1, restaurantId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
