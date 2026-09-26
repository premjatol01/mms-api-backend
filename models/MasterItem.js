const mongoose = require('mongoose');

const masterItemSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterCategory', required: true },
  name: { type: String, required: true },
  image: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('MasterItem', masterItemSchema);
