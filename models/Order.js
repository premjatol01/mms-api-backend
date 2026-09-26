const mongoose = require('mongoose');

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
