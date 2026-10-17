const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
  orderNumber: { type: String },
  source: { type: String, enum: ['qr', 'manual'], default: 'qr' },
  customer: {
    mobile: { type: String, default: null },
    name: { type: String, default: null },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null }
  },
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number },
    imageUrl: { type: String },
    cancelledQty: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'processing', 'served', 'cancelled'], default: 'pending' }
  }],
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  appliedOffer: { type: Object, default: null },
  status: { type: String, enum: ['pending', 'processing', 'served', 'partially_cancelled', 'cancelled'], default: 'pending' },
  cancellations: [{
    itemId: mongoose.Schema.Types.ObjectId,
    quantity: Number,
    reason: { type: String, enum: ['customer_request', 'item_unavailable', 'kitchen_issue', 'other'] },
    comment: String,
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
