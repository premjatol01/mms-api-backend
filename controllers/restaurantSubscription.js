const Restaurant = require('../models/Restaurant');
const Package = require('../models/Package');
const Subscription = require('../models/Subscription');
const RenewalRequest = require('../models/RenewalRequest');
const SubscriptionTicket = require('../models/SubscriptionTicket');
const PlatformSettings = require('../models/PlatformSettings');

/**
 * Helper to compute realtime subscription status and days remaining
 */
function computeRealtimeSub(sub) {
  if (!sub || !sub.endDate) {
    return {
      status: 'pending',
      daysRemaining: 0,
      isExpired: false,
      isExpiring: false,
      isActive: false
    };
  }

  const now = new Date();
  const end = new Date(sub.endDate);
  const diffTime = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining <= 0;
  const isExpiring = !isExpired && daysRemaining <= 7;
  const isActive = !isExpired;

  let computedStatus = 'active';
  if (isExpired) computedStatus = 'expired';
  else if (isExpiring) computedStatus = 'expiring';

  return {
    status: computedStatus,
    daysRemaining: Math.max(0, daysRemaining),
    isExpired,
    isExpiring,
    isActive
  };
}

// @desc    Get restaurant subscription overview, packages, payment config, history, and tickets
// @route   GET /api/restaurant/subscription
// @access  Private (Restaurant Admin)
exports.getSubscriptionOverview = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId).populate('subscription.packageId');
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Compute realtime status for restaurant subscription
    const rawSub = restaurant.subscription ? restaurant.subscription.toObject() : {};
    const realtime = computeRealtimeSub(rawSub);
    const subscription = {
      ...rawSub,
      status: realtime.status,
      daysRemaining: realtime.daysRemaining,
      isExpired: realtime.isExpired,
      isExpiring: realtime.isExpiring,
      isActive: realtime.isActive
    };

    // If packageId is populated, pull maxTables & features
    if (restaurant.subscription?.packageId) {
      const pkg = restaurant.subscription.packageId;
      subscription.maxTables = pkg.maxTables;
      subscription.features = pkg.features || [];
      subscription.description = pkg.description;
    }

    // Available Packages from database
    const packages = await Package.find({ status: 'active' }).sort({ price: 1, createdAt: 1 });

    // Payment Config from Platform Settings
    const settings = await PlatformSettings.findOne({});
    const paymentConfig = {
      paymentQrUrl: settings?.paymentQrUrl || null,
      paymentUpiId: settings?.paymentUpiId || 'tablly@upi',
      paymentAccountName: settings?.paymentAccountName || 'Tablly Technologies',
      paymentBankDetails: settings?.paymentBankDetails || '',
      paymentInstructions: settings?.paymentInstructions || 'Scan the QR code, pay the amount, and upload the screenshot with transaction reference / UTR number.'
    };

    // Pending payment requests
    const pendingPayment = await RenewalRequest.findOne({
      restaurantId,
      status: 'pending'
    }).sort({ createdAt: -1 });

    // Payment / Request History
    const history = await RenewalRequest.find({ restaurantId }).sort({ createdAt: -1 });

    // Support Tickets
    const tickets = await SubscriptionTicket.find({ restaurantId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          adminName: restaurant.admin?.name || req.user.name,
          adminEmail: restaurant.admin?.email || req.user.email,
          adminPhone: restaurant.admin?.phone || restaurant.contact?.phone || ''
        },
        subscription,
        packages,
        paymentConfig,
        hasPendingPayment: Boolean(pendingPayment),
        pendingPayment,
        history,
        tickets
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit payment screenshot for manual verification
// @route   POST /api/restaurant/subscription/payment
// @access  Private (Restaurant Admin)
exports.submitPaymentProof = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload your payment screenshot.' });
    }

    // Check if another request is already pending review
    const pendingExisting = await RenewalRequest.findOne({ restaurantId, status: 'pending' });
    if (pendingExisting) {
      return res.status(400).json({
        success: false,
        message: 'A payment verification request is already pending. Super admin will review it shortly.'
      });
    }

    const {
      packageId,
      packageName,
      duration,
      durationDays,
      durationDisplay,
      amount,
      transactionRef,
      userNote,
      requestType
    } = req.body;

    const screenshotUrl = `/uploads/subscription-proofs/${req.file.filename}`;

    const renewal = await RenewalRequest.create({
      restaurantId,
      restaurantName: restaurant.name,
      adminName: restaurant.admin?.name || req.user.name,
      adminEmail: restaurant.admin?.email || req.user.email,
      adminPhone: restaurant.admin?.phone || restaurant.contact?.phone || '',
      packageId: packageId || null,
      planName: packageName || restaurant.subscription?.packageName || 'Subscription Plan',
      duration: duration || '30_days',
      durationDays: Number(durationDays) || 30,
      durationDisplay: durationDisplay || `${durationDays || 30} Days`,
      amount: Number(amount) || 0,
      transactionRef: (transactionRef || '').trim(),
      screenshotUrl,
      screenshot: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        url: screenshotUrl
      },
      requestType: requestType || 'renew',
      userNote: (userNote || '').trim(),
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      data: renewal,
      message: 'Payment screenshot submitted successfully! Super admin will verify your payment and confirm your subscription.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Raise a support ticket / note regarding subscription
// @route   POST /api/restaurant/subscription/ticket
// @access  Private (Restaurant Admin)
exports.createTicket = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const { subject, message, paymentRequestId } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Ticket subject is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Ticket message is required' });
    }

    const count = await SubscriptionTicket.countDocuments();
    const ticketNumber = `TKT-${1000 + count + 1}`;

    const ticket = await SubscriptionTicket.create({
      ticketNumber,
      restaurantId,
      restaurantName: restaurant.name,
      adminName: restaurant.admin?.name || req.user.name,
      adminEmail: restaurant.admin?.email || req.user.email,
      adminPhone: restaurant.admin?.phone || restaurant.contact?.phone || '',
      subject: subject.trim(),
      message: message.trim(),
      paymentRequestId: paymentRequestId || null,
      status: 'open'
    });

    res.status(201).json({
      success: true,
      data: ticket,
      message: `Ticket ${ticketNumber} raised successfully. Super admin will review it.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get support tickets for restaurant
// @route   GET /api/restaurant/subscription/tickets
// @access  Private (Restaurant Admin)
exports.getTickets = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const tickets = await SubscriptionTicket.find({ restaurantId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
