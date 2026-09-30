const Table = require('../models/Table');
const QrCode = require('../models/QrCode');
const QRTemplate = require('../models/QRTemplate');
const Restaurant = require('../models/Restaurant');
const QRCodeLib = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Ensure upload directory for table QRs exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'table-qrs');
fs.mkdirSync(uploadDir, { recursive: true });

exports.getTables = async (req, res) => {
  try {
    const tables = await Table.find({ restaurantId: req.user.restaurantId })
      .populate('qrCodeId')
      .sort({ number: 1 });
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTables = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { count, templateId } = req.body;

    if (!count || count < 1 || count > 20) {
      return res.status(400).json({ success: false, message: 'Count must be between 1 and 20' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    let template = null;
    let templateBuffer = null;
    let templateMeta = null;

    if (templateId) {
      template = await QRTemplate.findById(templateId);
      if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
      
      const templatePath = path.join(__dirname, '..', 'public', template.imagePath);
      if (fs.existsSync(templatePath)) {
        templateBuffer = fs.readFileSync(templatePath);
        templateMeta = await sharp(templateBuffer).metadata();
      }
    }

    // Determine starting number
    const lastTable = await Table.findOne({ restaurantId }).sort({ number: -1 });
    let startNumber = lastTable && lastTable.number ? lastTable.number + 1 : 1;

    const createdTables = [];
    const baseDomain = process.env.BASE_DOMAIN || 'tablly.com';
    const subdomain = restaurant.website?.subdomain || restaurant._id.toString();

    for (let i = 0; i < count; i++) {
      const number = startNumber + i;
      
      // 1. Create table
      const table = await Table.create({
        restaurantId,
        tableId: `TBL-${number}`,
        number,
        status: 'active'
      });

      let qrImageUrl = null;
      let qrCodeDoc = null;

      // 2. If a template is provided, generate QR and overlay
      if (template && templateBuffer && templateMeta) {
        const scanUrl = `https://${subdomain}.${baseDomain}/menu/${table._id}`;
        
        // Calculate dimensions
        const qrSizePx = Math.round(templateMeta.width * (template.qrSize / 100));
        const leftPx = Math.round(templateMeta.width * (template.qrX / 100));
        const topPx = Math.round(templateMeta.height * (template.qrY / 100));

        // Generate QR code buffer
        const qrBuffer = await QRCodeLib.toBuffer(scanUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: qrSizePx,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        // Composite the QR code onto the template
        const finalImageBuffer = await sharp(templateBuffer)
          .composite([{ input: qrBuffer, left: leftPx, top: topPx }])
          .toBuffer();

        // Save to disk
        const filename = `qr-${restaurantId}-${table._id}-${Date.now()}.png`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, finalImageBuffer);

        qrImageUrl = `/uploads/table-qrs/${filename}`;

        // Create QrCode document
        qrCodeDoc = await QrCode.create({
          restaurantId,
          name: `Table ${number} QR`,
          type: 'template',
          status: 'assigned',
          tableId: table._id,
          imageUrl: qrImageUrl,
          scanUrl
        });

        // Update table with QrCode reference
        table.qrCodeId = qrCodeDoc._id;
        await table.save();
      }

      // We populate manually to return the full object
      const populatedTable = table.toObject();
      if (qrCodeDoc) {
        populatedTable.qrCodeId = qrCodeDoc.toObject();
      }
      createdTables.push(populatedTable);
    }

    res.status(201).json({ success: true, data: createdTables, message: `${count} tables created successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
