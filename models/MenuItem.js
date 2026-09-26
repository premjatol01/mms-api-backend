const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory' },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  mrp: { type: Number },
  image: { type: String },
  foodType: { type: String, enum: ['veg', 'non-veg', 'egg'] },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  isPopular: { type: Boolean, default: false },
  isBestseller: { type: Boolean, default: false },
  prepTime: { type: Number },
  serves: { type: Number },
  calories: { type: Number },
  spiciness: { type: String, enum: ['none', 'mild', 'medium', 'spicy', 'extra-spicy'] },
  dietaryFlags: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
