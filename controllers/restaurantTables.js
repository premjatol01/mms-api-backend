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

/**
 * Shared helper: build the final QR image buffer for a given scanUrl + optional template.
 */
async function buildQRImageBuffer(scanUrl, template) {
  let templateBuffer = null;
  let templateMeta = null;

  if (template) {
    const templatePath = path.join(__dirname, '..', 'public', template.imagePath);
    if (fs.existsSync(templatePath)) {
      templateBuffer = fs.readFileSync(templatePath);
      templateMeta = await sharp(templateBuffer).metadata();
    }
  }

  if (template && templateBuffer && templateMeta) {
    const qrSizePx = Math.round(templateMeta.width * (template.qrSize / 100));
    const leftPx = Math.round(templateMeta.width * (template.qrX / 100));
    const topPx = Math.round(templateMeta.height * (template.qrY / 100));

    const qrBuffer = await QRCodeLib.toBuffer(scanUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: qrSizePx,
      color: { dark: '#000000', light: '#ffffff' }
    });

    const format = (templateMeta.format || '').toLowerCase();
    let pipeline = sharp(templateBuffer)
      .composite([{ input: qrBuffer, left: leftPx, top: topPx }]);

    if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 6, adaptiveFiltering: true });
    } else if (format === 'jpeg' || format === 'jpg') {
      pipeline = pipeline.jpeg({ quality: 98, chromaSubsampling: '4:4:4' });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality: 98, lossless: true });
    }

    return pipeline.toBuffer();
  }

  // Plain QR fallback
  return QRCodeLib.toBuffer(scanUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' }
  });
}

/**
 * Shared helper: build the correct scan URL for a restaurant + tableId label.
 * Format: http(s)://{subdomain}.{baseDomain}/menu/{tableLabel}
 * Falls back to plain domain path if no subdomain is configured.
 */
function buildScanUrl(restaurant, tableLabel) {
  const baseDomain = process.env.BASE_DOMAIN || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const subdomain = restaurant.website?.subdomain;

  if (subdomain) {
    return `${protocol}://${subdomain}.${baseDomain}/menu/${encodeURIComponent(tableLabel)}`;
  }
  // No subdomain configured yet — use a fallback path
  return `${protocol}://${baseDomain}/restaurant/${restaurant._id}/menu/${encodeURIComponent(tableLabel)}`;
}

/**
 * Regenerate the QR image for a given qrDoc using its associated table's label.
 * Called both at initial generation and whenever a QR is assigned/reassigned to a table.
 */
async function regenerateQRImage(qrDoc, restaurant, tableLabel) {
  const template = qrDoc.templateId
    ? await QRTemplate.findById(qrDoc.templateId)
    : null;

  const scanUrl = buildScanUrl(restaurant, tableLabel);
  qrDoc.scanUrl = scanUrl;

  const imageBuffer = await buildQRImageBuffer(scanUrl, template);

  const filename = `qr-${restaurant._id}-${qrDoc._id}.png`;
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, imageBuffer);

  qrDoc.imageUrl = `/uploads/table-qrs/${filename}`;
  await qrDoc.save();
  return qrDoc;
}

// ─── TABLES ────────────────────────────────────────────────────────────────

exports.getTables = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const tables = await Table.find({ restaurantId })
      .populate('qrCodeId')
      .sort({ createdAt: -1 });

    const restaurant = await Restaurant.findById(restaurantId).populate('subscription.packageId');
    let maxTables = 15;
    let planName = 'Basic';
    if (restaurant?.subscription?.packageId?.maxTables) {
      maxTables = restaurant.subscription.packageId.maxTables;
      planName = restaurant.subscription.packageId.name || restaurant.subscription.packageName || 'Basic';
    } else if (restaurant?.subscription?.packageName) {
      planName = restaurant.subscription.packageName;
      const Package = require('../models/Package');
      const pkg = await Package.findOne({ name: new RegExp(`^${restaurant.subscription.packageName}$`, 'i') });
      if (pkg?.maxTables) maxTables = pkg.maxTables;
    }

    res.status(200).json({
      success: true,
      data: tables,
      maxTables,
      planName
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId).populate('subscription.packageId');
    let maxTables = 15;
    let planName = 'Basic';
    if (restaurant?.subscription?.packageId?.maxTables) {
      maxTables = restaurant.subscription.packageId.maxTables;
      planName = restaurant.subscription.packageId.name || restaurant.subscription.packageName || 'Basic';
    } else if (restaurant?.subscription?.packageName) {
      planName = restaurant.subscription.packageName;
      const Package = require('../models/Package');
      const pkg = await Package.findOne({ name: new RegExp(`^${restaurant.subscription.packageName}$`, 'i') });
      if (pkg?.maxTables) maxTables = pkg.maxTables;
    }

    const currentTableCount = await Table.countDocuments({ restaurantId });

    // Handle batch creation (from Profile Table Configuration)
    if (req.body.count !== undefined) {
      const count = parseInt(req.body.count, 10);
      if (isNaN(count) || count < 1) {
        return res.status(400).json({ success: false, message: 'Please enter a valid number of tables' });
      }

      if (currentTableCount + count > maxTables) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${count} tables. Your ${planName} plan allows a maximum of ${maxTables} tables (you currently have ${currentTableCount}).`
        });
      }

      const { templateId } = req.body;
      let qrTemplate = null;
      if (templateId && templateId !== 'normal') {
        qrTemplate = await QRTemplate.findById(templateId);
      }

      // Find highest existing table number to continue sequence smoothly
      const existingTables = await Table.find({ restaurantId }).select('tableNo tableId');
      let maxNum = 0;
      for (const t of existingTables) {
        const num = parseInt((t.tableNo || t.tableId || '').replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }

      const createdTables = [];
      for (let i = 1; i <= count; i++) {
        const tableNum = maxNum + i;
        const tableLabel = `${tableNum}`;

        const table = await Table.create({
          restaurantId,
          tableId: tableLabel,
          tableNo: tableLabel,
          number: tableNum,
          status: 'active'
        });

        // Always create default QR code (with template overlay if selected, or normal plain QR)
        const scanUrl = buildScanUrl(restaurant, table._id);
        const qrDoc = new QrCode({
          restaurantId,
          tableId: table._id,
          name: `Table ${tableNum} QR`,
          status: 'assigned',
          templateId: qrTemplate ? qrTemplate._id : null,
          scanUrl
        });

        const imageBuffer = await buildQRImageBuffer(scanUrl, qrTemplate);
        const filename = `qr-${restaurantId}-${qrDoc._id}.png`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, imageBuffer);

        qrDoc.imageUrl = `/uploads/table-qrs/${filename}`;
        await qrDoc.save();

        table.qrCodeId = qrDoc._id;
        await table.save();

        const populated = await Table.findById(table._id).populate('qrCodeId');
        createdTables.push(populated);
      }

      return res.status(201).json({
        success: true,
        data: createdTables,
        message: `${count} tables created with default QR code successfully`
      });
    }

    // Single table creation (from Tables & QR module)
    const { tableId: inputTableId, tableNo: inputTableNo, status, qrCodeId } = req.body;
    const rawLabel = (inputTableNo || inputTableId || '').trim();
    const cleanNum = rawLabel.replace(/^table\s*/i, '').trim();
    const userLabel = cleanNum || rawLabel;

    if (!userLabel) {
      return res.status(400).json({ success: false, message: 'Table number is required' });
    }

    if (currentTableCount >= maxTables) {
      return res.status(400).json({
        success: false,
        message: `Your ${planName} plan table limit (${maxTables}) reached. Please upgrade your subscription to add more tables.`
      });
    }

    const exists = await Table.findOne({
      restaurantId,
      $or: [
        { tableNo: new RegExp(`^${userLabel}$`, 'i') },
        { tableId: new RegExp(`^${userLabel}$`, 'i') },
        { tableNo: new RegExp(`^Table\\s*${userLabel}$`, 'i') },
        { tableId: new RegExp(`^Table\\s*${userLabel}$`, 'i') }
      ]
    });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Table number already exists' });
    }

    const tableNum = parseInt(userLabel.replace(/\D/g, ''), 10) || undefined;
    const table = await Table.create({
      restaurantId,
      tableId: userLabel,
      tableNo: userLabel,
      number: tableNum,
      status: status || 'active',
      qrCodeId: qrCodeId || undefined
    });

    if (qrCodeId) {
      const qrDoc = await QrCode.findByIdAndUpdate(qrCodeId, { tableId: table._id, status: 'assigned' }, { new: true });
      if (qrDoc) {
        await regenerateQRImage(qrDoc, restaurant, table._id);
      }
    }

    const populated = await Table.findById(table._id).populate('qrCodeId');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { tableId: inputTableId, tableNo: inputTableNo, status, qrCodeId, templateId } = req.body;

    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    const rawLabel = (inputTableNo || inputTableId || '').trim();
    const cleanNum = rawLabel.replace(/^table\s*/i, '').trim();
    const userLabel = cleanNum || rawLabel;

    if (userLabel) {
      const exists = await Table.findOne({
        restaurantId: req.user.restaurantId,
        _id: { $ne: req.params.id },
        $or: [
          { tableNo: new RegExp(`^${userLabel}$`, 'i') },
          { tableId: new RegExp(`^${userLabel}$`, 'i') },
          { tableNo: new RegExp(`^Table\\s*${userLabel}$`, 'i') },
          { tableId: new RegExp(`^Table\\s*${userLabel}$`, 'i') }
        ]
      });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Table number already exists' });
      }
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    // Handle explicit QR reassignment
    if (qrCodeId !== undefined && String(qrCodeId) !== String(table.qrCodeId)) {
      if (table.qrCodeId) {
        await QrCode.findByIdAndUpdate(table.qrCodeId, { tableId: null, status: 'available' });
      }
      if (qrCodeId) {
        const qrDoc = await QrCode.findByIdAndUpdate(qrCodeId, { tableId: table._id, status: 'assigned' }, { new: true });
        if (qrDoc) {
          await regenerateQRImage(qrDoc, restaurant, table._id);
        }
      }
    } else if (table.qrCodeId) {
      const qrDoc = await QrCode.findById(table.qrCodeId);
      if (qrDoc && (!qrDoc.scanUrl || !qrDoc.scanUrl.includes(`/menu/${table._id}`))) {
        await regenerateQRImage(qrDoc, restaurant, table._id);
      }
    }

    // Handle templateId update for table's QR code
    if (templateId !== undefined) {
      const targetTemplateId = (templateId && templateId !== 'plain' && templateId !== 'normal') ? templateId : null;
      if (table.qrCodeId) {
        const qrDoc = await QrCode.findById(table.qrCodeId);
        if (qrDoc) {
          qrDoc.templateId = targetTemplateId;
          await qrDoc.save();
          await regenerateQRImage(qrDoc, restaurant, table._id);
        }
      } else if (targetTemplateId !== undefined && templateId !== null) {
        const scanUrl = buildScanUrl(restaurant, table._id);
        const qrTemplate = targetTemplateId ? await QRTemplate.findById(targetTemplateId) : null;
        const qrDoc = new QrCode({
          restaurantId: req.user.restaurantId,
          tableId: table._id,
          name: `${userLabel || table.tableNo || 'Table'} QR`,
          status: 'assigned',
          templateId: targetTemplateId,
          scanUrl
        });
        const imageBuffer = await buildQRImageBuffer(scanUrl, qrTemplate);
        const filename = `qr-${req.user.restaurantId}-${qrDoc._id}.png`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        qrDoc.imageUrl = `/uploads/table-qrs/${filename}`;
        await qrDoc.save();
        table.qrCodeId = qrDoc._id;
        await table.save();
      }
    }

    const payload = {};
    if (userLabel) {
      payload.tableNo = userLabel;
      payload.tableId = userLabel;
    }
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

    if (table.qrCodeId) {
      await QrCode.findByIdAndUpdate(table.qrCodeId, { tableId: null, status: 'available' });
    }

    await table.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── QR CODES ──────────────────────────────────────────────────────────────

exports.getQRCodes = async (req, res) => {
  try {
    const qrCodes = await QrCode.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: qrCodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/restaurant/tables/qr
 * Generates a QR code (with optional template overlay).
 * At this point the table is unknown so scanUrl is a placeholder.
 * The real URL is baked in when the QR is assigned to a table.
 */
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
    if (templateId) {
      template = await QRTemplate.findById(templateId);
      if (!template) return res.status(404).json({ success: false, message: 'QR Template not found' });
    }

    const createdQRs = [];

    for (let i = 0; i < count; i++) {
      const qrDoc = await QrCode.create({
        restaurantId,
        name: `QR-${Date.now()}-${i}`,
        type: 'template',
        status: 'available',
        templateId: template ? template._id : null,
        imageUrl: '',
        scanUrl: ''
      });

      // Placeholder scan URL — will be replaced with the real table URL upon assignment
      const placeholderUrl = buildScanUrl(restaurant, `table-${qrDoc._id.toString().slice(-4)}`);
      qrDoc.scanUrl = placeholderUrl;

      const imageBuffer = await buildQRImageBuffer(placeholderUrl, template);

      const filename = `qr-${restaurantId}-${qrDoc._id}.png`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, imageBuffer);

      qrDoc.imageUrl = `/uploads/table-qrs/${filename}`;
      qrDoc.name = template
        ? `${template.name} - ${qrDoc._id.toString().slice(-4).toUpperCase()}`
        : `QR-${qrDoc._id.toString().slice(-4).toUpperCase()}`;

      await qrDoc.save();
      createdQRs.push(qrDoc);
    }

    res.status(201).json({ success: true, data: createdQRs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/restaurant/tables/qr/assign
 * Assign a QR code to a table. Regenerates the QR image with the real menu URL.
 */
exports.assignQRToTable = async (req, res) => {
  try {
    const { tableId: tableDocId, qrCodeId } = req.body;

    const table = await Table.findOne({ _id: tableDocId, restaurantId: req.user.restaurantId });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    const qrDoc = await QrCode.findOne({ _id: qrCodeId, restaurantId: req.user.restaurantId });
    if (!qrDoc) return res.status(404).json({ success: false, message: 'QR Code not found' });

    // Unassign old QR if any
    if (table.qrCodeId) {
      await QrCode.findByIdAndUpdate(table.qrCodeId, { tableId: null, status: 'available' });
    }

    // Assign and regenerate image with real URL
    const restaurant = await Restaurant.findById(req.user.restaurantId);
    qrDoc.tableId = table._id;
    qrDoc.status = 'assigned';
    await regenerateQRImage(qrDoc, restaurant, table._id);

    table.qrCodeId = qrDoc._id;
    await table.save();

    const populated = await Table.findById(table._id).populate('qrCodeId');
    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/restaurant/tables/qr/regenerate-all
 * Regenerates every assigned QR image for this restaurant using the correct
 * subdomain-based menu URL. Call this once after setting BASE_DOMAIN or
 * after updating the restaurant's website subdomain.
 */
exports.regenerateAllQRCodes = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    // Find all tables that have a QR assigned
    const tables = await Table.find({ restaurantId, qrCodeId: { $ne: null } });

    let regenerated = 0;
    for (const table of tables) {
      const qrDoc = await QrCode.findById(table.qrCodeId);
      if (!qrDoc) continue;
      await regenerateQRImage(qrDoc, restaurant, table._id);
      regenerated++;
    }

    res.status(200).json({
      success: true,
      message: `Regenerated ${regenerated} QR code(s) with updated URLs.`,
      data: { regenerated }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteQRCode = async (req, res) => {
  try {
    const qrCode = await QrCode.findById(req.params.id);
    if (!qrCode) return res.status(404).json({ success: false, message: 'QR Code not found' });

    if (qrCode.tableId) {
      await Table.findByIdAndUpdate(qrCode.tableId, { qrCodeId: null });
    }

    if (qrCode.imageUrl) {
      const filepath = path.join(__dirname, '..', 'public', qrCode.imageUrl);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }

    await qrCode.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
