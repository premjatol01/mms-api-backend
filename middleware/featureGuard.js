const Restaurant = require('../models/Restaurant');
const Package = require('../models/Package');

/**
 * Checks if the authenticated restaurant admin's active subscription includes the required feature.
 * If user is super_admin, access is always granted.
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      if (req.user?.role === 'super_admin') {
        return next();
      }

      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        return res.status(403).json({
          success: false,
          code: 'RESTAURANT_REQUIRED',
          message: 'No associated restaurant found for this account.'
        });
      }

      const restaurant = await Restaurant.findById(restaurantId).populate('subscription.packageId');
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restaurant not found' });
      }

      // 1. Resolve package features
      let features = [];
      let planName = restaurant.subscription?.packageName || 'Basic';

      if (restaurant.subscription?.packageId?.features) {
        features = restaurant.subscription.packageId.features;
        planName = restaurant.subscription.packageId.name || planName;
      } else if (restaurant.subscription?.packageName) {
        const pkg = await Package.findOne({
          name: new RegExp(`^${restaurant.subscription.packageName}$`, 'i')
        });
        if (pkg?.features) {
          features = pkg.features;
          planName = pkg.name;
        }
      }

      // If restaurant subscription has custom features array or free trial
      if (restaurant.subscription?.features && Array.isArray(restaurant.subscription.features)) {
        features = Array.from(new Set([...features, ...restaurant.subscription.features]));
      }

      // If plan is Free Trial, grant all features by default
      if (planName.toLowerCase().includes('free trial') || planName.toLowerCase().includes('trial')) {
        req.restaurantFeatures = features;
        req.restaurantPlanName = planName;
        return next();
      }

      // Check if feature is granted
      if (!features.includes(featureKey)) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_LOCKED',
          feature: featureKey,
          planName,
          message: `The '${featureKey}' feature is not included in your ${planName} plan. Please upgrade your subscription to unlock this feature.`
        });
      }

      req.restaurantFeatures = features;
      req.restaurantPlanName = planName;
      next();
    } catch (err) {
      console.error('Feature guard error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };
};

module.exports = { requireFeature };
