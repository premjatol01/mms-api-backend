const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms'],
      default: 'whatsapp',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Document automatically removed by MongoDB once expiresAt is reached
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);
