const mongoose = require('mongoose');

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
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customerMobile: { type: String, default: null },
  customerName: { type: String, default: null },
  appliedOffer: { type: Object, default: null },
  startedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
