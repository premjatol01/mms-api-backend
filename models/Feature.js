const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  category: {
    type: String,
    enum: ['QR', 'Website', 'Offers', 'Reviews', 'Other'],
    required: true
  },
  description: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  displayOrder: { type: Number, default: 0 },
  packages: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Feature', featureSchema);
