const mongoose = require('mongoose');

const comboSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  description: { type: String },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
  price: { type: Number, required: true },
  mrp: { type: Number },
  image: { type: String },
  badge: { type: String },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  isPopular: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Combo', comboSchema);
