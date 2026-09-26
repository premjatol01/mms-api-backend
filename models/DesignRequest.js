const mongoose = require('mongoose');

const designRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  description: { type: String, required: true },
  attachment: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('DesignRequest', designRequestSchema);
