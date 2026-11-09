const mongoose = require('mongoose');

const bizGrowthSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['blog', 'youtube', 'news', 'social'],
      required: [true, 'Resource type is required'],
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      default: '',
      trim: true,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'Marketing',
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      default: '',
      trim: true,
    },
    sourceName: {
      type: String,
      default: 'Tablly Growth Team',
      trim: true,
    },
    readTime: {
      type: String,
      default: '5 min read',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BizGrowth', bizGrowthSchema);
