const mongoose = require('mongoose');

const designRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  requestType: { 
    type: String, 
    enum: ['Menu Design', 'QR Template Design', 'Other'], 
    default: 'Menu Design' 
  },
  title: { type: String, default: '' },
  description: { type: String, required: true },
  attachment: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'rejected'], 
    default: 'pending' 
  },
  adminRemarks: { type: String, default: '' },
  completedAttachment: {
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    url: { type: String }
  },
  completedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('DesignRequest', designRequestSchema);
