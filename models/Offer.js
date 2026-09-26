const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['repeat_order', 'order_value', 'low_traffic'],
    required: true
  },
  benefit: {
    type: { type: String, enum: ['percentage', 'flat'] },
    value: { type: Number }
  },
  validity: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  terms: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  previousOrderAmount: { type: Number },
  repeatWithinDays: { type: Number },
  minimumOrderAmount: { type: Number },
  promotionMode: { type: String, enum: ['order_value', 'menu_item'] },
  dayType: { type: String, enum: ['day_of_week', 'specific_date'] },
  dayOfWeek: { type: String },
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  menuItemName: { type: String },
  performance: {
    timesAvailed: { type: Number, default: 0 },
    totalDiscountGiven: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
