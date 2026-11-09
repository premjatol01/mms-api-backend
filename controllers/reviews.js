const mongoose = require('mongoose');
const CustomerReview = require('../models/CustomerReview');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const Customer = require('../models/Customer');
const { emitToRestaurant } = require('../socket');

// Helper to resolve restaurant by subdomain or ID
async function resolveRestaurant(subdomain, restaurantId) {
  if (subdomain) {
    const cleanSubdomain = subdomain.trim().toLowerCase();
    const r = await Restaurant.findOne({
      $or: [
        { 'website.subdomain': cleanSubdomain },
        { slug: cleanSubdomain }
      ]
    });
    if (r) return r;
  }

  if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    return await Restaurant.findById(restaurantId);
  }

  return null;
}

// @route   POST /api/reviews/public
// @desc    Submit customer review from table portal
// @access  Public
exports.createPublicReview = async (req, res) => {
  try {
    const {
      subdomain,
      restaurantId,
      tableId,
      tableName,
      sessionId,
      customerName,
      customerMobile,
      rating,
      comment
    } = req.body;

    // Validate rating
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid rating between 1 and 5'
      });
    }

    // Validate mobile number
    if (!customerMobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required to submit a review'
      });
    }

    const cleanMobile = String(customerMobile).replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number'
      });
    }

    // Resolve restaurant
    const restaurant = await resolveRestaurant(subdomain, restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Resolve table if tableId provided
    let resolvedTable = null;
    if (tableId && mongoose.isValidObjectId(tableId)) {
      resolvedTable = await Table.findById(tableId);
    }

    const resolvedTableName =
      tableName ||
      resolvedTable?.tableNo ||
      resolvedTable?.tableId ||
      '';

    const displayName = customerName && customerName.trim()
      ? customerName.trim()
      : `User ${cleanMobile.slice(-4)}`;

    // Sync or update Customer in Customer collection
    try {
      await Customer.findOneAndUpdate(
        { restaurantId: restaurant._id, mobile: cleanMobile },
        {
          $setOnInsert: {
            restaurantId: restaurant._id,
            mobile: cleanMobile,
            firstVisitAt: new Date()
          },
          $set: {
            name: displayName,
            lastVisitAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    } catch (custErr) {
      console.warn('Customer upsert warning during review:', custErr.message);
    }

    // Create review
    const review = new CustomerReview({
      restaurantId: restaurant._id,
      tableId: resolvedTable ? resolvedTable._id : (tableId && mongoose.isValidObjectId(tableId) ? tableId : null),
      tableName: resolvedTableName,
      sessionId: sessionId && mongoose.isValidObjectId(sessionId) ? sessionId : null,
      customerName: displayName,
      customerMobile: cleanMobile,
      rating: numRating,
      comment: comment ? comment.trim() : '',
      status: 'pending',
      submittedAt: new Date()
    });

    await review.save();

    // Broadcast review to restaurant admin dashboard in real-time
    emitToRestaurant(restaurant._id, 'review:created', {
      id: review._id.toString(),
      _id: review._id.toString(),
      customerName: review.customerName,
      customerMobile: review.customerMobile,
      rating: review.rating,
      comment: review.comment,
      submittedAt: review.submittedAt.toISOString(),
      status: review.status,
      tableName: review.tableName
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully! Thank you for your feedback.',
      data: {
        id: review._id.toString(),
        _id: review._id.toString(),
        customerName: review.customerName,
        customerMobile: review.customerMobile,
        rating: review.rating,
        comment: review.comment,
        submittedAt: review.submittedAt.toISOString(),
        status: review.status
      }
    });
  } catch (error) {
    console.error('Error submitting public review:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   GET /api/reviews/public/:subdomain
// @desc    Get verified reviews for public display, plus the customer's own reviews if customerMobile is provided
// @access  Public
exports.getPublicReviews = async (req, res) => {
  try {
    const { subdomain } = req.params;
    const restaurant = await resolveRestaurant(subdomain, null);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const rawMobile = req.query.customerMobile || '';
    const cleanMobile = rawMobile ? String(rawMobile).replace(/\D/g, '').slice(-10) : '';

    let reviewQuery;
    if (cleanMobile && cleanMobile.length === 10) {
      // Show all accepted (verified) reviews, PLUS any review submitted by this specific customer
      reviewQuery = {
        restaurantId: restaurant._id,
        $or: [
          { status: 'accepted' },
          { customerMobile: cleanMobile }
        ]
      };
    } else {
      // Public / anonymous users only see accepted (verified) reviews
      reviewQuery = {
        restaurantId: restaurant._id,
        status: 'accepted'
      };
    }

    const reviews = await CustomerReview.find(reviewQuery)
      .sort({ submittedAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: reviews.map((r) => ({
        id: r._id.toString(),
        name: r.customerName || (r.customerMobile ? `User ${r.customerMobile.slice(-4)}` : 'Guest'),
        rating: r.rating,
        comment: r.comment || '',
        status: r.status,
        customerMobile: r.customerMobile,
        tableName: r.tableName || '',
        createdAt: r.submittedAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching public reviews:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   GET /api/reviews
// @desc    Get paginated reviews and summary counts for restaurant admin
// @access  Private (Restaurant Admin)
exports.getAdminReviews = async (req, res) => {
  try {
    const restaurantId = req.user?.restaurantId || req.restaurant?._id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, message: 'Restaurant identifier missing from token' });
    }

    const { status, rating, datePreset, dateFrom, dateTo, tzOffset, page = 1, pageSize = 10 } = req.query;
    const restObjId = new mongoose.Types.ObjectId(restaurantId);

    const query = { restaurantId: restObjId };

    if (status && status.trim()) {
      query.status = status.trim();
    }

    if (rating && String(rating).trim()) {
      query.rating = Number(rating);
    }

    // Timezone offset in minutes (e.g. -330 for UTC+5:30 IST)
    const offsetMinutes = tzOffset !== undefined && tzOffset !== '' ? parseInt(tzOffset, 10) : -330;

    if (datePreset === 'today') {
      const now = new Date();
      // Calculate local midnight in client timezone
      const localNow = new Date(now.getTime() - offsetMinutes * 60 * 1000);
      const y = localNow.getUTCFullYear();
      const m = localNow.getUTCMonth();
      const d = localNow.getUTCDate();
      const startMs = Date.UTC(y, m, d) + offsetMinutes * 60 * 1000;
      const endMs = Date.UTC(y, m, d, 23, 59, 59, 999) + offsetMinutes * 60 * 1000;
      query.submittedAt = { $gte: new Date(startMs), $lte: new Date(endMs) };
    } else if (datePreset === 'yesterday') {
      const now = new Date();
      const localNow = new Date(now.getTime() - offsetMinutes * 60 * 1000);
      localNow.setUTCDate(localNow.getUTCDate() - 1);
      const y = localNow.getUTCFullYear();
      const m = localNow.getUTCMonth();
      const d = localNow.getUTCDate();
      const startMs = Date.UTC(y, m, d) + offsetMinutes * 60 * 1000;
      const endMs = Date.UTC(y, m, d, 23, 59, 59, 999) + offsetMinutes * 60 * 1000;
      query.submittedAt = { $gte: new Date(startMs), $lte: new Date(endMs) };
    } else if ((dateFrom && dateFrom.trim()) || (dateTo && dateTo.trim())) {
      query.submittedAt = {};
      if (dateFrom && dateFrom.trim()) {
        const str = dateFrom.trim();
        if (str.includes('T')) {
          query.submittedAt.$gte = new Date(str);
        } else {
          const [y, m, d] = str.split('-').map(Number);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const startMs = Date.UTC(y, m - 1, d) + offsetMinutes * 60 * 1000;
            query.submittedAt.$gte = new Date(startMs);
          } else {
            query.submittedAt.$gte = new Date(`${str}T00:00:00.000Z`);
          }
        }
      }
      if (dateTo && dateTo.trim()) {
        const str = dateTo.trim();
        if (str.includes('T')) {
          query.submittedAt.$lte = new Date(str);
        } else {
          const [y, m, d] = str.split('-').map(Number);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offsetMinutes * 60 * 1000;
            query.submittedAt.$lte = new Date(endMs);
          } else {
            query.submittedAt.$lte = new Date(`${str}T23:59:59.999Z`);
          }
        }
      }
    }

    const numPage = Math.max(1, parseInt(page, 10) || 1);
    const numPageSize = Math.max(1, parseInt(pageSize, 10) || 10);
    const skip = (numPage - 1) * numPageSize;

    // Fetch matching count and paginated items in parallel
    const [total, reviews, statsAgg] = await Promise.all([
      CustomerReview.countDocuments(query),
      CustomerReview.find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(numPageSize),
      CustomerReview.aggregate([
        { $match: { restaurantId: restObjId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const stats = statsAgg[0] || {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0
    };
    delete stats._id;

    const items = reviews.map((r) => ({
      id: r._id.toString(),
      _id: r._id.toString(),
      customerName: r.customerName || (r.customerMobile ? `User ${r.customerMobile.slice(-4)}` : 'Anonymous'),
      customerMobile: r.customerMobile,
      rating: r.rating,
      comment: r.comment || '',
      submittedAt: r.submittedAt.toISOString(),
      status: r.status,
      tableName: r.tableName || ''
    }));

    return res.status(200).json({
      success: true,
      data: {
        items,
        total,
        stats,
        page: numPage,
        pageSize: numPageSize
      }
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   PATCH /api/reviews/:id/status
// @desc    Moderate a review (accept / reject)
// @access  Private (Restaurant Admin)
exports.moderateAdminReview = async (req, res) => {
  try {
    const restaurantId = req.user?.restaurantId || req.restaurant?._id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, message: 'Restaurant identifier missing from token' });
    }
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "accepted" or "rejected"'
      });
    }

    const review = await CustomerReview.findOne({ _id: id, restaurantId });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    if (review.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This review has already been moderated.'
      });
    }

    review.status = status;
    await review.save();

    return res.status(200).json({
      success: true,
      message: `Review ${status} successfully.`,
      data: {
        id: review._id.toString(),
        _id: review._id.toString(),
        status: review.status
      }
    });
  } catch (error) {
    console.error('Error moderating review:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
