const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  restaurantName: { type: String, required: true },
  address: {
    fullAddress: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    pincode: { type: String }
  },
  contactPerson: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  restaurantType: {
    type: String,
    enum: ['Fine Dining', 'Casual Dining', 'Quick Bites', 'Cafe', 'Hotel Restaurant', 'Food Truck', 'Bakery', 'Bar & Restaurant']
  },
  website: { type: String },
  stage: {
    type: String,
    enum: ['prospect', 'new_lead', 'contacted', 'qualified', 'interested', 'follow_up', 'converted', 'lost'],
    default: 'new_lead'
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  notes: { type: String },
  convertedRestaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  activity: [{
    date: { type: Date, default: Date.now },
    action: { type: String, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
