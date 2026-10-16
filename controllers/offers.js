const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');

// Helper to resolve Restaurant ID from either ObjectId or subdomain
async function resolveRestaurant(identifier) {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const restaurant = await Restaurant.findById(identifier);
    if (restaurant) return restaurant;
  }
  const cleanSubdomain = String(identifier).trim().toLowerCase();
  return await Restaurant.findOne({
    'website.subdomain': { $regex: new RegExp(`^${cleanSubdomain}$`, 'i') }
  });
}

// ==========================================
// RESTAURANT ADMIN ENDPOINTS (Protected)
// ==========================================

/**
 * GET /api/offers
 * List all offers for the logged-in restaurant
 */
exports.getOffers = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'No restaurant associated with this user' });
    }

    const offers = await Offer.find({ restaurantId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: offers.length, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error fetching offers' });
  }
};

/**
 * GET /api/offers/:id
 * Get details of a single offer
 */
exports.getOfferById = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const offer = await Offer.findOne({ _id: req.params.id, restaurantId });

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    res.status(200).json({ success: true, data: offer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error fetching offer' });
  }
};

/**
 * POST /api/offers
 * Create a new offer
 */
exports.createOffer = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'No restaurant associated with this user' });
    }

    const {
      name,
      type,
      benefit,
      validity,
      terms,
      status,
      previousOrderAmount,
      repeatWithinDays,
      minimumOrderAmount,
      promotionMode,
      dayType,
      dayOfWeek,
      specificDate,
      menuItemId,
      menuItemName
    } = req.body;

    // Basic Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Offer name is required' });
    }

    if (!['repeat_order', 'order_value', 'low_traffic'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid offer type' });
    }

    if (!benefit || benefit.value === undefined || benefit.value === null || benefit.value <= 0) {
      return res.status(400).json({ success: false, message: 'A valid discount value is required' });
    }

    const benefitType = benefit.type || 'percentage';
    if (!['percentage', 'flat'].includes(benefitType)) {
      return res.status(400).json({ success: false, message: 'Benefit type must be either percentage or flat' });
    }

    if (benefitType === 'percentage' && (benefit.value < 1 || benefit.value > 100)) {
      return res.status(400).json({ success: false, message: 'Percentage discount must be between 1 and 100' });
    }

    if (!validity || !validity.startDate || !validity.endDate) {
      return res.status(400).json({ success: false, message: 'Both start date and end date are required' });
    }

    if (new Date(validity.endDate) < new Date(validity.startDate)) {
      return res.status(400).json({ success: false, message: 'End date cannot be earlier than start date' });
    }

    // Type-specific validation
    if (type === 'repeat_order') {
      if (!previousOrderAmount || previousOrderAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Previous order amount must be greater than 0' });
      }
      if (!repeatWithinDays || repeatWithinDays <= 0) {
        return res.status(400).json({ success: false, message: 'Repeat within days must be greater than 0' });
      }
    } else if (type === 'order_value') {
      if (!minimumOrderAmount || minimumOrderAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Minimum order amount must be greater than 0' });
      }
    } else if (type === 'low_traffic') {
      if (!['order_value', 'menu_item'].includes(promotionMode)) {
        return res.status(400).json({ success: false, message: 'Promotion mode must be order_value or menu_item' });
      }
      if (!['day_of_week', 'specific_date'].includes(dayType)) {
        return res.status(400).json({ success: false, message: 'Day type must be day_of_week or specific_date' });
      }
      if (dayType === 'day_of_week' && !dayOfWeek) {
        return res.status(400).json({ success: false, message: 'Please select a day of the week' });
      }
      if (dayType === 'specific_date' && !specificDate) {
        return res.status(400).json({ success: false, message: 'Please select a specific date' });
      }
      if (promotionMode === 'order_value' && (!minimumOrderAmount || minimumOrderAmount <= 0)) {
        return res.status(400).json({ success: false, message: 'Minimum order amount must be greater than 0' });
      }
      if (promotionMode === 'menu_item' && !menuItemId) {
        return res.status(400).json({ success: false, message: 'Please select a menu item' });
      }
    }

    const offerData = {
      restaurantId,
      name: name.trim(),
      type,
      benefit: {
        type: benefitType,
        value: Number(benefit.value)
      },
      validity: {
        startDate: new Date(validity.startDate),
        endDate: new Date(validity.endDate)
      },
      terms: terms || '',
      status: status || 'active',
      previousOrderAmount: type === 'repeat_order' ? Number(previousOrderAmount) : undefined,
      repeatWithinDays: type === 'repeat_order' ? Number(repeatWithinDays) : undefined,
      minimumOrderAmount: (type === 'order_value' || (type === 'low_traffic' && promotionMode === 'order_value'))
        ? Number(minimumOrderAmount)
        : undefined,
      promotionMode: type === 'low_traffic' ? promotionMode : undefined,
      dayType: type === 'low_traffic' ? dayType : undefined,
      dayOfWeek: type === 'low_traffic' && dayType === 'day_of_week' ? dayOfWeek : undefined,
      specificDate: type === 'low_traffic' && dayType === 'specific_date' ? specificDate : undefined,
      menuItemId: type === 'low_traffic' && promotionMode === 'menu_item' && mongoose.Types.ObjectId.isValid(menuItemId)
        ? menuItemId
        : undefined,
      menuItemName: type === 'low_traffic' && promotionMode === 'menu_item' ? menuItemName : undefined,
      performance: { timesAvailed: 0, totalDiscountGiven: 0 }
    };

    const newOffer = await Offer.create(offerData);
    res.status(201).json({ success: true, data: newOffer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error creating offer' });
  }
};

/**
 * PUT /api/offers/:id
 * Update an existing offer
 */
exports.updateOffer = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const offer = await Offer.findOne({ _id: req.params.id, restaurantId });

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const {
      name,
      type,
      benefit,
      validity,
      terms,
      status,
      previousOrderAmount,
      repeatWithinDays,
      minimumOrderAmount,
      promotionMode,
      dayType,
      dayOfWeek,
      specificDate,
      menuItemId,
      menuItemName
    } = req.body;

    // Validate if fields are provided
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, message: 'Offer name cannot be empty' });
      offer.name = name.trim();
    }

    if (type !== undefined) {
      if (!['repeat_order', 'order_value', 'low_traffic'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid offer type' });
      }
      offer.type = type;
    }

    if (benefit !== undefined) {
      const benefitType = benefit.type || offer.benefit?.type || 'percentage';
      if (!['percentage', 'flat'].includes(benefitType)) {
        return res.status(400).json({ success: false, message: 'Benefit type must be percentage or flat' });
      }
      if (benefit.value === undefined || benefit.value === null || benefit.value <= 0) {
        return res.status(400).json({ success: false, message: 'A valid discount value is required' });
      }
      if (benefitType === 'percentage' && (benefit.value < 1 || benefit.value > 100)) {
        return res.status(400).json({ success: false, message: 'Percentage discount must be between 1 and 100' });
      }
      offer.benefit = {
        type: benefitType,
        value: Number(benefit.value)
      };
    }

    if (validity !== undefined) {
      if (!validity.startDate || !validity.endDate) {
        return res.status(400).json({ success: false, message: 'Both start date and end date are required' });
      }
      if (new Date(validity.endDate) < new Date(validity.startDate)) {
        return res.status(400).json({ success: false, message: 'End date cannot be earlier than start date' });
      }
      offer.validity = {
        startDate: new Date(validity.startDate),
        endDate: new Date(validity.endDate)
      };
    }

    if (terms !== undefined) offer.terms = terms;
    if (status !== undefined) offer.status = status;

    // Specific fields based on type
    const effectiveType = offer.type;
    if (effectiveType === 'repeat_order') {
      if (previousOrderAmount !== undefined) offer.previousOrderAmount = Number(previousOrderAmount);
      if (repeatWithinDays !== undefined) offer.repeatWithinDays = Number(repeatWithinDays);
    } else if (effectiveType === 'order_value') {
      if (minimumOrderAmount !== undefined) offer.minimumOrderAmount = Number(minimumOrderAmount);
    } else if (effectiveType === 'low_traffic') {
      if (promotionMode !== undefined) offer.promotionMode = promotionMode;
      if (dayType !== undefined) offer.dayType = dayType;
      if (dayOfWeek !== undefined) offer.dayOfWeek = dayOfWeek;
      if (specificDate !== undefined) offer.specificDate = specificDate;
      if (minimumOrderAmount !== undefined) offer.minimumOrderAmount = Number(minimumOrderAmount);
      if (menuItemId !== undefined) {
        offer.menuItemId = mongoose.Types.ObjectId.isValid(menuItemId) ? menuItemId : undefined;
      }
      if (menuItemName !== undefined) offer.menuItemName = menuItemName;
    }

    const updated = await offer.save();
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error updating offer' });
  }
};

/**
 * PATCH /api/offers/:id/status
 * Toggle or set offer status (active/inactive)
 */
exports.toggleOfferStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const offer = await Offer.findOne({ _id: req.params.id, restaurantId });

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const nextStatus = req.body.status
      ? req.body.status
      : (offer.status === 'active' ? 'inactive' : 'active');

    if (!['active', 'inactive'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    }

    offer.status = nextStatus;
    await offer.save();

    res.status(200).json({ success: true, data: offer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error toggling offer status' });
  }
};

/**
 * DELETE /api/offers/:id
 * Delete an offer
 */
exports.deleteOffer = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const offer = await Offer.findOneAndDelete({ _id: req.params.id, restaurantId });

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    res.status(200).json({ success: true, message: 'Offer deleted successfully', data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error deleting offer' });
  }
};

// ==========================================
// PUBLIC CUSTOMER ENDPOINTS (QR Menu)
// ==========================================

/**
 * GET /api/public/offers/:restaurantId
 * Returns currently active, date-valid offers for customer view
 */
exports.getPublicOffers = async (req, res) => {
  try {
    const restaurant = await resolveRestaurant(req.params.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const now = new Date();
    const offers = await Offer.find({
      restaurantId: restaurant._id,
      status: 'active'
    }).sort({ createdAt: -1 });

    // Filter by validity date range
    const validOffers = offers.filter((o) => {
      if (o.validity?.endDate) {
        const end = new Date(o.validity.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      if (o.validity?.startDate) {
        const start = new Date(o.validity.startDate);
        start.setHours(0, 0, 0, 0);
        if (start > now) return false;
      }
      return true;
    });

    res.status(200).json({ success: true, count: validOffers.length, data: validOffers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error fetching public offers' });
  }
};

/**
 * POST /api/public/offers/check-eligibility
 * Evaluates active offers against customer mobile, current order total, and cart items
 * Body: { restaurantId, mobile, currentOrderTotal, items, tableId }
 */
exports.checkOfferEligibility = async (req, res) => {
  try {
    const { restaurantId, mobile, currentOrderTotal = 0, items = [] } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'restaurantId is required' });
    }

    const restaurant = await resolveRestaurant(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[now.getDay()];
    const currentDateStr = now.toISOString().split('T')[0];

    // Fetch active offers
    const offers = await Offer.find({
      restaurantId: restaurant._id,
      status: 'active'
    }).sort({ createdAt: -1 });

    // Filter date-valid offers
    const validOffers = offers.filter((o) => {
      if (o.validity?.endDate) {
        const end = new Date(o.validity.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      if (o.validity?.startDate) {
        const start = new Date(o.validity.startDate);
        start.setHours(0, 0, 0, 0);
        if (start > now) return false;
      }
      return true;
    });

    // Query past orders by customer's mobile number if provided
    let pastOrders = [];
    const cleanMobile = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : null;
    if (cleanMobile && cleanMobile.length === 10) {
      pastOrders = await Order.find({
        restaurantId: restaurant._id,
        'customer.mobile': cleanMobile,
        status: { $ne: 'cancelled' }
      }).sort({ createdAt: -1 });
    }

    const cartTotal = Number(currentOrderTotal) || 0;

    // Evaluate each offer
    const evaluatedOffers = validOffers.map((offer) => {
      const offerObj = offer.toObject();
      let isEligible = false;
      let eligibilityText = '';
      let potentialDiscount = 0;

      // 1. Repeat Order Offer
      if (offer.type === 'repeat_order') {
        const targetAmount = offer.previousOrderAmount || 0;
        const windowDays = offer.repeatWithinDays || 7;

        if (!cleanMobile) {
          isEligible = false;
          eligibilityText = 'Please verify your mobile number to unlock this repeat order offer.';
        } else {
          const cutoffDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
          const qualifyingOrder = pastOrders.find((ord) => {
            const orderDate = new Date(ord.createdAt);
            return orderDate >= cutoffDate && (ord.total || ord.subtotal || 0) >= targetAmount;
          });

          if (qualifyingOrder) {
            isEligible = true;
            eligibilityText = `You qualify based on your recent order above ₹${targetAmount}!`;
          } else {
            isEligible = false;
            eligibilityText = `Requires a previous order over ₹${targetAmount} placed in the last ${windowDays} days.`;
          }
        }
      }

      // 2. Order Value Offer
      else if (offer.type === 'order_value') {
        const minAmount = offer.minimumOrderAmount || 0;
        if (cartTotal >= minAmount) {
          isEligible = true;
          eligibilityText = 'You qualify based on your current order value!';
        } else {
          const diff = minAmount - cartTotal;
          isEligible = false;
          eligibilityText = `Add ₹${diff} more to your cart to qualify.`;
        }
      }

      // 3. Low Traffic / Promotional Offer
      else if (offer.type === 'low_traffic') {
        let dayMatches = false;
        if (offer.dayType === 'day_of_week') {
          dayMatches = String(offer.dayOfWeek).toLowerCase() === currentDayName.toLowerCase();
        } else if (offer.dayType === 'specific_date') {
          const offerDateStr = offer.specificDate ? new Date(offer.specificDate).toISOString().split('T')[0] : '';
          dayMatches = offerDateStr === currentDateStr;
        }

        if (!dayMatches) {
          isEligible = false;
          eligibilityText = offer.dayType === 'day_of_week'
            ? `Valid only on ${offer.dayOfWeek}s.`
            : `Valid only on ${offer.specificDate}.`;
        } else {
          // Day matches, now evaluate promotion mode
          if (offer.promotionMode === 'order_value') {
            const minAmount = offer.minimumOrderAmount || 0;
            if (cartTotal >= minAmount) {
              isEligible = true;
              eligibilityText = `Eligible for ${offer.dayOfWeek || 'today'}'s special!`;
            } else {
              isEligible = false;
              eligibilityText = `Add ₹${minAmount - cartTotal} more to qualify for today's special.`;
            }
          } else if (offer.promotionMode === 'menu_item') {
            // Check if cart contains the target menuItemId or matching item
            const hasItem = Array.isArray(items) && items.some((item) => {
              const itemId = item.id || item.menuItemId || item._id;
              const itemName = item.name || item.title;
              return (
                (offer.menuItemId && String(itemId) === String(offer.menuItemId)) ||
                (offer.menuItemName && itemName && itemName.toLowerCase() === offer.menuItemName.toLowerCase())
              );
            });

            if (hasItem) {
              isEligible = true;
              eligibilityText = `Eligible! Discount applies to ${offer.menuItemName || 'selected item'}.`;
            } else {
              isEligible = false;
              eligibilityText = `Add ${offer.menuItemName || 'qualifying item'} to cart to unlock.`;
            }
          }
        }
      }

      // Calculate potential discount
      if (isEligible) {
        if (offer.benefit?.type === 'percentage') {
          potentialDiscount = Math.round(((cartTotal * (offer.benefit.value || 0)) / 100) * 100) / 100;
        } else {
          // Flat discount
          potentialDiscount = Math.min(offer.benefit?.value || 0, cartTotal);
        }
      }

      return {
        ...offerObj,
        isEligible,
        eligibilityText,
        potentialDiscount
      };
    });

    res.status(200).json({
      success: true,
      count: evaluatedOffers.length,
      data: evaluatedOffers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error checking eligibility' });
  }
};
