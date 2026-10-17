const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  totalVisits: {
    type: Number,
    default: 1
  },
  totalSpend: {
    type: Number,
    default: 0
  },
  lastSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }],
  firstVisitAt: {
    type: Date,
    default: Date.now
  },
  lastVisitAt: {
    type: Date,
    default: Date.now
  },
  lastOrderAt: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Ensure customer is unique per restaurant
customerSchema.index({ restaurantId: 1, mobile: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);
