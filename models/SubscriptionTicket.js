const mongoose = require('mongoose');

const subscriptionTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String },
  adminName: { type: String },
  adminEmail: { type: String },
  adminPhone: { type: String },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  paymentRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'RenewalRequest' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
  adminReply: { type: String, default: '' },
  repliedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionTicket', subscriptionTicketSchema);
