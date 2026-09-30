const mongoose = require('mongoose');

const menuCategorySchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  masterCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterCategory' },
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  itemCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('MenuCategory', menuCategorySchema);
