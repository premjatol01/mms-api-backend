const Table = require('../models/Table');
const QrCode = require('../models/QrCode');
const QRTemplate = require('../models/QRTemplate');
const Restaurant = require('../models/Restaurant');
const QRCodeLib = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'table-qrs');
fs.mkdirSync(uploadDir, { recursive: true });

exports.getTables = async (req, res) => {
  try {
    const tables = await Table.find({ restaurantId: req.user.restaurantId })
      .populate('qrCodeId')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const { tableId, status, qrCodeId } = req.body;
    
    // Check if tableId already exists
    const exists = await Table.findOne({ restaurantId: req.user.restaurantId, tableId: new RegExp(`^${tableId}$`, 'i') });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Table No. already exists' });
    }

    const payload = {
      restaurantId: req.user.restaurantId,
      tableId,
      status: status || 'active',
      qrCodeId: qrCodeId || undefined
    };

    const table = await Table.create(payload);
    
    if (qrCodeId) {
      await QrCode.findByIdAndUpdate(qrCodeId, { tableId: table._id, status: 'assigned' });
    }

    const populated = await Table.findById(table._id).populate('qrCodeId');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { tableId, status, qrCodeId } = req.body;
    
    // Check if tableId exists for another table
    if (tableId) {
      const exists = await Table.findOne({ 
        restaurantId: req.user.restaurantId, 
        tableId: new RegExp(`^${tableId}$`, 'i'),
        _id: { $ne: req.params.id }
      });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Table No. already exists' });
      }
    }

    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    
    // If QR code is changing, unassign old one and assign new one
    if (qrCodeId !== undefined && String(qrCodeId) !== String(table.qrCodeId)) {
      if (table.qrCodeId) {
        await QrCode.findByIdAndUpdate(table.qrCodeId, { tableId: null, status: 'available' });
      }
      if (qrCodeId) {
        await QrCode.findByIdAndUpdate(qrCodeId, { tableId: table._id, status: 'assigned' });
      }
    }

    const payload = {};
    if (tableId) payload.tableId = tableId;
    if (status) payload.status = status;
    if (qrCodeId !== undefined) payload.qrCodeId = qrCodeId || null;

    const updated = await Table.findByIdAndUpdate(req.params.id, payload, { new: true }).populate('qrCodeId');
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    
    // Unassign its QR code
    if (table.qrCodeId) {
      await QrCode.findByIdAndUpdate(table.qrCodeId, { tableId: null, status: 'available' });
    }

    await table.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQRCodes = async (req, res) => {
  try {
    const qrCodes = await QrCode.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: qrCodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateQRCodes = async (req, res) => {
  try {
    const { count = 1, templateId } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!count || count < 1 || count > 50) {
      return res.status(400).json({ success: false, message: 'Count must be between 1 and 50' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    let template = null;
    let templateBuffer = null;
    let templateMeta = null;

    if (templateId) {
      template = await QRTemplate.findById(templateId);
      if (!template) return res.status(404).json({ success: false, message: 'QR Template not found' });

      const templatePath = path.join(__dirname, '..', 'public', template.imagePath);
      if (fs.existsSync(templatePath)) {
        templateBuffer = fs.readFileSync(templatePath);
        templateMeta = await sharp(templateBuffer).metadata();
      }
    }

    const baseDomain = process.env.BASE_DOMAIN || 'tablly.com';
    const subdomain = restaurant.website?.subdomain || restaurant._id.toString();

    const createdQRs = [];

    for (let i = 0; i < count; i++) {
      const qrDoc = await QrCode.create({
        restaurantId,
        name: `QR-${Date.now()}-${i}`,
        type: 'template',
        status: 'available',
        imageUrl: '',
        scanUrl: ''
      });

      const scanUrl = `https://${subdomain}.${baseDomain}/qr/${qrDoc._id}`;
      qrDoc.scanUrl = scanUrl;

      let finalImageBuffer;

      if (template && templateBuffer && templateMeta) {
        // Calculate QR placement based on template percentages
        const qrSizePx = Math.round(templateMeta.width * (template.qrSize / 100));
        const leftPx = Math.round(templateMeta.width * (template.qrX / 100));
        const topPx = Math.round(templateMeta.height * (template.qrY / 100));

        const qrBuffer = await QRCodeLib.toBuffer(scanUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: qrSizePx,
          color: { dark: '#000000', light: '#ffffff' }
        });

        finalImageBuffer = await sharp(templateBuffer)
          .composite([{ input: qrBuffer, left: leftPx, top: topPx }])
          .toBuffer();
      } else {
        // Plain standard QR
        finalImageBuffer = await QRCodeLib.toBuffer(scanUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 512,
          color: { dark: '#000000', light: '#ffffff' }
        });
      }

      const filename = `qr-${restaurantId}-${qrDoc._id}.png`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, finalImageBuffer);

      qrDoc.imageUrl = `/uploads/table-qrs/${filename}`;
      qrDoc.name = template
        ? `${template.name} - ${qrDoc._id.toString().slice(-4).toUpperCase()}`
        : `QR-${qrDoc._id.toString().slice(-4).toUpperCase()}`;
      
      if (template) qrDoc.templateId = template._id;

      await qrDoc.save();
      createdQRs.push(qrDoc);
    }

    res.status(201).json({ success: true, data: createdQRs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteQRCode = async (req, res) => {
  try {
    const qrCode = await QrCode.findById(req.params.id);
    if (!qrCode) return res.status(404).json({ success: false, message: 'QR Code not found' });

    // Unassign from table if assigned
    if (qrCode.tableId) {
      await Table.findByIdAndUpdate(qrCode.tableId, { qrCodeId: null });
    }

    // Optionally delete image from disk
    if (qrCode.imageUrl) {
      const filepath = path.join(__dirname, '..', 'public', qrCode.imageUrl);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    await qrCode.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
