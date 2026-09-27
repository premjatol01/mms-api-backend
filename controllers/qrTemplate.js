const QRTemplate = require('../models/QRTemplate');
const path = require('path');
const fs = require('fs');

// @desc    Get all QR templates
// @route   GET /api/qr-templates
exports.getTemplates = async (req, res) => {
  try {
    const templates = await QRTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
};

// @desc    Get single template
// @route   GET /api/qr-templates/:id
exports.getTemplate = async (req, res) => {
  try {
    const template = await QRTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching template', error: error.message });
  }
};

// @desc    Upload new template
// @route   POST /api/qr-templates
exports.uploadTemplate = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Template image is required' });
    }

    const newTemplate = new QRTemplate({
      name,
      imagePath: `/uploads/qrcodes/${req.file.filename}`,
      status: 'active'
    });

    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ message: 'Error uploading template', error: error.message });
  }
};

// @desc    Update coordinates & settings
// @route   PUT /api/qr-templates/:id
exports.updateTemplate = async (req, res) => {
  try {
    const { name, qrX, qrY, qrSize, status } = req.body;
    
    const template = await QRTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (name !== undefined) template.name = name;
    if (qrX !== undefined) template.qrX = qrX;
    if (qrY !== undefined) template.qrY = qrY;
    if (qrSize !== undefined) template.qrSize = qrSize;
    if (status !== undefined) template.status = status;

    await template.save();
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error updating template', error: error.message });
  }
};

// @desc    Delete template
// @route   DELETE /api/qr-templates/:id
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await QRTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Optional: Remove file from disk
    const filePath = path.join(__dirname, '..', 'public', template.imagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    await QRTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting template', error: error.message });
  }
};
