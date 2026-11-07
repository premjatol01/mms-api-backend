const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Restaurant = require('../models/Restaurant');
const Package = require('../models/Package');

// Helper to determine real-time status of a subscription
function computeRealtimeStatus(sub) {
  if (sub.status === 'cancelled') return 'cancelled';
  const now = new Date();
  const start = new Date(sub.startDate);
  const end = new Date(sub.endDate);
  
  if (start > now) return 'scheduled';
  if (end < now) return 'expired';
  
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diffDays > 0 && diffDays <= 7) return 'expiring';
  
  return 'active';
}

// Auto-sync restaurants with subscriptions to ensure every restaurant with active subscription exists in Subscription collection
async function syncMissingSubscriptions() {
  try {
    const restaurantsWithSub = await Restaurant.find({ 
      'subscription.packageName': { $exists: true, $ne: '' } 
    });

    for (const rest of restaurantsWithSub) {
      const existing = await Subscription.findOne({ restaurantId: rest._id, status: { $ne: 'cancelled' } });
      if (!existing && rest.subscription?.packageName) {
        let pkg = null;
        if (rest.subscription.packageId) {
          pkg = await Package.findById(rest.subscription.packageId);
        }
        if (!pkg) {
          pkg = await Package.findOne({ name: new RegExp('^' + rest.subscription.packageName + '$', 'i') });
        }

        const durationDays = Number(rest.subscription.duration) || 30;
        const start = rest.subscription.startDate ? new Date(rest.subscription.startDate) : new Date();
        const end = rest.subscription.endDate ? new Date(rest.subscription.endDate) : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

        await Subscription.create({
          restaurantId: rest._id,
          restaurantName: rest.name,
          adminName: rest.admin?.name || '',
          adminEmail: rest.admin?.email || '',
          packageId: pkg?._id || rest.subscription.packageId || new mongoose.Types.ObjectId(),
          packageName: rest.subscription.packageName,
          duration: durationDays,
          durationDisplay: rest.subscription.durationDisplay || `${durationDays} Days`,
          startDate: start,
          endDate: end,
          price: rest.subscription.price || pkg?.price || 0,
          status: rest.subscription.status || 'active',
          features: pkg?.features || []
        });
      }
    }
  } catch (err) {
    console.warn('Subscription auto-sync warning:', err.message);
  }
}

// @desc    Get all subscriptions with filters, search, pagination, and summary metrics
// @route   GET /api/subscriptions
// @access  Private (Super Admin)
exports.getSubscriptions = async (req, res) => {
  try {
    await syncMissingSubscriptions();

    const { 
      search, 
      status, 
      package: pkgFilter, 
      duration, 
      page = 1, 
      limit = 10 
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { restaurantName: { $regex: search, $options: 'i' } },
        { adminName: { $regex: search, $options: 'i' } },
        { adminEmail: { $regex: search, $options: 'i' } },
        { packageName: { $regex: search, $options: 'i' } }
      ];
    }

    // Package filter
    if (pkgFilter) {
      query.packageName = { $regex: new RegExp(`^${pkgFilter}$`, 'i') };
    }

    // Duration filter
    if (duration) {
      query.duration = Number(duration);
    }

    // Status filter
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (status) {
      if (status === 'active') {
        query.status = 'active';
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
      } else if (status === 'expiring') {
        query.status = 'active';
        query.startDate = { $lte: now };
        query.endDate = { $gte: now, $lte: sevenDaysLater };
      } else if (status === 'expired') {
        query.$or = [
          { status: 'expired' },
          { status: 'active', endDate: { $lt: now } }
        ];
      } else if (status === 'cancelled') {
        query.status = 'cancelled';
      } else if (status === 'scheduled') {
        query.$or = [
          { status: 'scheduled' },
          { startDate: { $gt: now } }
        ];
      }
    }

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const startIndex = (pageNum - 1) * limitNum;

    const total = await Subscription.countDocuments(query);
    const subscriptions = await Subscription.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limitNum);

    // Compute summary metrics across all subscriptions
    const allSubs = await Subscription.find({});
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    allSubs.forEach((sub) => {
      const computed = computeRealtimeStatus(sub);
      if (computed === 'active') activeCount++;
      else if (computed === 'expiring') expiringCount++;
      else if (computed === 'expired' || computed === 'cancelled') expiredCount++;
    });

    // Map realtime status
    const data = subscriptions.map((sub) => {
      const doc = sub.toObject();
      doc.realtimeStatus = computeRealtimeStatus(sub);
      if (doc.status === 'active' && doc.realtimeStatus === 'expiring') {
        doc.status = 'expiring';
      } else if (doc.status === 'active' && doc.realtimeStatus === 'expired') {
        doc.status = 'expired';
      }
      return doc;
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
      },
      summary: {
        total: allSubs.length,
        active: activeCount,
        expiring: expiringCount,
        expired: expiredCount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get summary statistics
// @route   GET /api/subscriptions/summary
// @access  Private (Super Admin)
exports.getSubscriptionSummary = async (req, res) => {
  try {
    await syncMissingSubscriptions();

    const allSubs = await Subscription.find({});
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    allSubs.forEach((sub) => {
      const computed = computeRealtimeStatus(sub);
      if (computed === 'active') activeCount++;
      else if (computed === 'expiring') expiringCount++;
      else if (computed === 'expired' || computed === 'cancelled') expiredCount++;
    });

    res.status(200).json({
      success: true,
      data: {
        total: allSubs.length,
        active: activeCount,
        expiring: expiringCount,
        expired: expiredCount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single subscription
// @route   GET /api/subscriptions/:id
// @access  Private (Super Admin)
exports.getSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    const doc = sub.toObject();
    doc.realtimeStatus = computeRealtimeStatus(sub);
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign subscription to restaurant
// @route   POST /api/subscriptions
// @access  Private (Super Admin)
exports.assignSubscription = async (req, res) => {
  try {
    const { 
      restaurantId, 
      packageId, 
      packageName, 
      duration = 30, 
      durationDisplay, 
      startDate = new Date(),
      price = 0
    } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Restaurant ID is required' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Resolve Package
    let pkg = null;
    if (packageId) {
      pkg = await Package.findById(packageId);
    }
    if (!pkg && packageName) {
      pkg = await Package.findOne({ name: new RegExp('^' + packageName + '$', 'i') });
    }
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    const durationDays = Number(duration) || 30;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + durationDays);

    const display = durationDisplay || (durationDays === 30 ? '1 Month (30 Days)' : durationDays === 180 ? '6 Months (180 Days)' : durationDays === 365 ? '12 Months / 1 Year' : `${durationDays} Days`);

    // Invalidate previous active subscriptions for this restaurant
    await Subscription.updateMany(
      { restaurantId: restaurant._id, status: 'active' },
      { $set: { status: 'cancelled' } }
    );

    // Create Subscription Document
    const subscription = await Subscription.create({
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      adminName: restaurant.admin?.name || '',
      adminEmail: restaurant.admin?.email || '',
      packageId: pkg._id,
      packageName: pkg.name,
      duration: durationDays,
      durationDisplay: display,
      startDate: start,
      endDate: end,
      price: Number(price) || pkg.price || 0,
      status: 'active',
      features: pkg.features || []
    });

    // Sync with Restaurant Document
    restaurant.subscription = {
      packageId: pkg._id,
      packageName: pkg.name,
      package: pkg.name,
      duration: String(durationDays),
      durationDisplay: display,
      price: Number(price) || pkg.price || 0,
      status: 'active',
      startDate: start,
      endDate: end
    };
    await restaurant.save();

    res.status(201).json({ 
      success: true, 
      data: subscription, 
      message: `Subscription assigned to ${restaurant.name} successfully` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Renew subscription
// @route   POST /api/subscriptions/:id/renew
// @access  Private (Super Admin)
exports.renewSubscription = async (req, res) => {
  try {
    const { duration = 30, durationDays, durationDisplay } = req.body;
    const daysToAdd = Number(durationDays || duration || 30);

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const currentEnd = new Date(subscription.endDate);
    const now = new Date();
    // If already expired, start extension from now; otherwise add to current expiration
    const baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(baseDate);
    newEnd.setDate(newEnd.getDate() + daysToAdd);

    subscription.endDate = newEnd;
    subscription.duration = (subscription.duration || 0) + daysToAdd;
    subscription.durationDisplay = durationDisplay || `${subscription.duration} Days`;
    subscription.status = 'active';
    await subscription.save();

    // Sync Restaurant Document
    const restaurant = await Restaurant.findById(subscription.restaurantId);
    if (restaurant) {
      if (!restaurant.subscription) restaurant.subscription = {};
      restaurant.subscription.endDate = newEnd;
      restaurant.subscription.duration = String(subscription.duration);
      restaurant.subscription.durationDisplay = subscription.durationDisplay;
      restaurant.subscription.status = 'active';
      await restaurant.save();
    }

    res.status(200).json({ 
      success: true, 
      data: subscription, 
      message: 'Subscription renewed successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change package tier (upgrade/downgrade)
// @route   PATCH /api/subscriptions/:id/package
// @access  Private (Super Admin)
exports.changePackage = async (req, res) => {
  try {
    const { packageName, packageId } = req.body;

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    let pkg = null;
    if (packageId) {
      pkg = await Package.findById(packageId);
    }
    if (!pkg && packageName) {
      pkg = await Package.findOne({ name: new RegExp('^' + packageName + '$', 'i') });
    }
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Target package not found' });
    }

    subscription.packageId = pkg._id;
    subscription.packageName = pkg.name;
    subscription.features = pkg.features || [];
    subscription.price = pkg.price || subscription.price || 0;
    await subscription.save();

    // Sync Restaurant Document
    const restaurant = await Restaurant.findById(subscription.restaurantId);
    if (restaurant) {
      if (!restaurant.subscription) restaurant.subscription = {};
      restaurant.subscription.packageId = pkg._id;
      restaurant.subscription.packageName = pkg.name;
      restaurant.subscription.package = pkg.name;
      restaurant.subscription.price = pkg.price || restaurant.subscription.price || 0;
      await restaurant.save();
    }

    res.status(200).json({ 
      success: true, 
      data: subscription, 
      message: `Package changed to ${pkg.name} successfully` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel subscription
// @route   PATCH /api/subscriptions/:id/cancel
// @access  Private (Super Admin)
exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    subscription.status = 'cancelled';
    await subscription.save();

    // Sync Restaurant Document
    const restaurant = await Restaurant.findById(subscription.restaurantId);
    if (restaurant && restaurant.subscription) {
      restaurant.subscription.status = 'cancelled';
      await restaurant.save();
    }

    res.status(200).json({ 
      success: true, 
      data: subscription, 
      message: 'Subscription cancelled successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reactivate subscription
// @route   PATCH /api/subscriptions/:id/reactivate
// @access  Private (Super Admin)
exports.reactivateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    // If past end date, extend by 30 days from now
    const now = new Date();
    if (new Date(subscription.endDate) < now) {
      const newEnd = new Date(now);
      newEnd.setDate(newEnd.getDate() + 30);
      subscription.startDate = now;
      subscription.endDate = newEnd;
      subscription.duration = 30;
      subscription.durationDisplay = '1 Month (30 Days)';
    }

    subscription.status = 'active';
    await subscription.save();

    // Sync Restaurant Document
    const restaurant = await Restaurant.findById(subscription.restaurantId);
    if (restaurant && restaurant.subscription) {
      restaurant.subscription.status = 'active';
      restaurant.subscription.endDate = subscription.endDate;
      restaurant.subscription.startDate = subscription.startDate;
      await restaurant.save();
    }

    res.status(200).json({ 
      success: true, 
      data: subscription, 
      message: 'Subscription reactivated successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
