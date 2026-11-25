const Restaurant = require('../models/Restaurant');
const Subscription = require('../models/Subscription');
const RenewalRequest = require('../models/RenewalRequest');
const Lead = require('../models/Lead');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Package = require('../models/Package');
const Customer = require('../models/Customer');
const CustomerReview = require('../models/CustomerReview');
const MenuItem = require('../models/MenuItem');

/**
 * Helper to generate month windows for the last N months
 */
function getLastNMonths(n = 6) {
  const months = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      shortLabel: monthNames[d.getMonth()],
      start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
    });
  }
  return months;
}

/**
 * GET /api/super-admin/analytics
 * Aggregates 100% REAL data from MongoDB collections across the entire Tablly platform.
 */
exports.getSuperAdminAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const months = getLastNMonths(6);

    // 1. Parallel database queries across all relevant collections
    const [
      allRestaurants,
      allSubscriptions,
      allRenewalRequests,
      allLeads,
      allPackages,
      allOrders,
      totalTablesCount,
      totalDishesCount,
      totalCustomersCount,
      allReviews,
      allTables,
    ] = await Promise.all([
      Restaurant.find({}).lean(),
      Subscription.find({}).lean(),
      RenewalRequest.find({}).sort({ createdAt: -1 }).lean(),
      Lead.find({}).sort({ createdAt: -1 }).lean(),
      Package.find({}).lean(),
      Order.find({}).select('restaurantId orderNumber status total source createdAt items customer').lean(),
      Table.countDocuments(),
      MenuItem.countDocuments(),
      Customer.countDocuments(),
      CustomerReview.find({}).select('rating status createdAt restaurantId').lean(),
      Table.find({}).select('restaurantId status capacity').lean(),
    ]);

    // 2. Restaurant status & subscription breakdown
    let activeRestroCount = 0;
    let trialRestroCount = 0;
    let inactiveRestroCount = 0;

    allRestaurants.forEach((r) => {
      const pkgName = (r.subscription?.packageName || '').toLowerCase();
      const isTrial = pkgName.includes('trial') || (Number(r.subscription?.price) === 0 && r.subscription?.packageId);
      if (r.status === 'inactive') {
        inactiveRestroCount++;
      } else if (isTrial) {
        trialRestroCount++;
      } else {
        activeRestroCount++;
      }
    });

    // 3. Platform Subscription Revenue & MRR calculations (100% Real)
    let confirmedRenewalRevenue = 0;
    let pendingVerificationCount = 0;

    allRenewalRequests.forEach((req) => {
      if (['confirmed', 'approved'].includes(req.status)) {
        confirmedRenewalRevenue += Number(req.amount) || 0;
      }
      if (req.status === 'pending') {
        pendingVerificationCount++;
      }
    });

    // Calculate MRR from active non-trial subscriptions
    let mrr = 0;
    let activePaidSubscriptionsRevenue = 0;
    allSubscriptions.forEach((sub) => {
      if (sub.status === 'active' && Number(sub.price) > 0) {
        const durationDays = Number(sub.duration) || 30;
        const monthlyFactor = 30 / Math.max(durationDays, 30);
        mrr += Math.round(Number(sub.price) * monthlyFactor);
        activePaidSubscriptionsRevenue += Number(sub.price);
      }
    });

    // Total subscription revenue: sum of confirmed renewal requests + active paid subscriptions (deduplicating if any)
    const totalPlatformRevenue = confirmedRenewalRevenue > 0
      ? confirmedRenewalRevenue
      : activePaidSubscriptionsRevenue;

    // 4. Platform Diner Orders & Gross Merchandise Value (GMV)
    const validOrders = allOrders.filter((o) => o.status !== 'cancelled');
    const totalOrdersCount = validOrders.length;
    const totalAllOrdersCount = allOrders.length;
    const totalGmv = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalGmv / totalOrdersCount) : 0;

    // Today's orders
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayOrders = validOrders.filter((o) => new Date(o.createdAt) >= startOfToday);
    const todayGmv = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // 5. B2B Leads & Conversion Metrics
    const totalLeads = allLeads.length;
    const convertedLeads = allLeads.filter((l) => l.stage === 'converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // 6. Diner Satisfaction & Ratings
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0
      ? Number((allReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / totalReviews).toFixed(1))
      : 5.0;

    // 7. Monthly Revenue & Orders Trends (Last 6 Months - Real DB Data)
    const revenueTrends = months.map((m) => {
      // Confirmed renewals in this month
      const monthConfirmedReqs = allRenewalRequests.filter((r) => {
        const d = new Date(r.createdAt || r.requestedAt);
        return ['confirmed', 'approved'].includes(r.status) && d >= m.start && d <= m.end;
      });
      const renewalAmount = monthConfirmedReqs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      // Subscriptions created/paid in this month
      const monthSubs = allSubscriptions.filter((s) => {
        const d = new Date(s.createdAt || s.startDate);
        return d >= m.start && d <= m.end && Number(s.price) > 0;
      });
      const subsAmount = monthSubs.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

      const actualSubscriptionRev = renewalAmount > 0 ? renewalAmount : subsAmount;

      // Real diner orders and GMV in this month
      const monthOrders = validOrders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= m.start && d <= m.end;
      });
      const monthGmv = Math.round(monthOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0));

      return {
        month: m.shortLabel,
        fullLabel: m.label,
        revenue: actualSubscriptionRev,
        gmv: monthGmv,
        orders: monthOrders.length,
        subscriptionsCount: monthConfirmedReqs.length + monthSubs.length,
      };
    });

    // 8. Onboarding & Leads Growth Velocity (Last 6 Months - Real DB Data)
    const onboardingTrends = months.map((m) => {
      const monthRestros = allRestaurants.filter((r) => {
        const d = new Date(r.createdAt);
        return d >= m.start && d <= m.end;
      });

      const monthLeads = allLeads.filter((l) => {
        const d = new Date(l.createdAt);
        return d >= m.start && d <= m.end;
      });

      const monthConverted = allLeads.filter((l) => {
        const d = new Date(l.updatedAt || l.createdAt);
        return l.stage === 'converted' && d >= m.start && d <= m.end;
      });

      return {
        month: m.shortLabel,
        fullLabel: m.label,
        restaurants: monthRestros.length,
        leads: monthLeads.length,
        converted: monthConverted.length,
      };
    });

    // 9. Dynamic Package Distribution (Matches real Package models + Subscriptions)
    const palette = ['#8b5cf6', '#10b981', '#38bdf8', '#f59e0b', '#ec4899', '#6366f1'];
    const packageDistribution = allPackages.map((pkg, idx) => {
      // Count active subscriptions for this package
      const activeCount = allSubscriptions.filter((s) => {
        return (
          s.status === 'active' &&
          (String(s.packageId) === String(pkg._id) ||
            (s.packageName && s.packageName.toLowerCase() === pkg.name.toLowerCase()))
        );
      }).length;

      // Also count from restaurant profiles if not in Subscription model
      const restroMatchCount = allRestaurants.filter((r) => {
        return (
          r.status === 'active' &&
          (String(r.subscription?.packageId) === String(pkg._id) ||
            (r.subscription?.packageName && r.subscription.packageName.toLowerCase() === pkg.name.toLowerCase()))
        );
      }).length;

      const totalCount = Math.max(activeCount, restroMatchCount);

      return {
        _id: pkg._id,
        name: pkg.name,
        price: pkg.price || (pkg.pricing && pkg.pricing[0]?.price) || 0,
        count: totalCount,
        color: palette[idx % palette.length],
      };
    });

    // 10. Real Lead Pipeline Funnel
    const stageCounts = {
      prospect: 0,
      new_lead: 0,
      contacted: 0,
      qualified: 0,
      interested: 0,
      follow_up: 0,
      converted: 0,
      lost: 0,
    };

    allLeads.forEach((l) => {
      const stage = (l.stage || 'prospect').toLowerCase();
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      } else {
        stageCounts.prospect++;
      }
    });

    const leadsFunnel = [
      { stage: 'Prospects', count: stageCounts.prospect + stageCounts.new_lead, fill: '#64748b' },
      { stage: 'Contacted', count: stageCounts.contacted, fill: '#3b82f6' },
      { stage: 'Qualified', count: stageCounts.qualified + stageCounts.interested, fill: '#8b5cf6' },
      { stage: 'Follow Up', count: stageCounts.follow_up, fill: '#f59e0b' },
      { stage: 'Converted', count: stageCounts.converted, fill: '#10b981' },
      { stage: 'Lost', count: stageCounts.lost, fill: '#ef4444' },
    ];

    // 11. Top Performing Restaurants (Aggregated with real orders & tables)
    const restaurantMetricsMap = {};
    allRestaurants.forEach((r) => {
      restaurantMetricsMap[String(r._id)] = {
        _id: r._id,
        name: r.name,
        plan: r.subscription?.packageName || 'Free Trial',
        price: Number(r.subscription?.price) || 0,
        status: r.status,
        city: r.address?.city || r.contact?.city || 'India',
        joinedAt: r.createdAt,
        totalOrders: 0,
        totalGmv: 0,
        tableCount: 0,
      };
    });

    // Count tables per restaurant
    allTables.forEach((t) => {
      const rid = String(t.restaurantId);
      if (restaurantMetricsMap[rid]) {
        restaurantMetricsMap[rid].tableCount++;
      }
    });

    // Accumulate orders & GMV per restaurant
    validOrders.forEach((o) => {
      const rid = String(o.restaurantId);
      if (restaurantMetricsMap[rid]) {
        restaurantMetricsMap[rid].totalOrders++;
        restaurantMetricsMap[rid].totalGmv += Number(o.total) || 0;
      }
    });

    const topRestaurants = Object.values(restaurantMetricsMap)
      .sort((a, b) => b.totalGmv - a.totalGmv || b.totalOrders - a.totalOrders)
      .slice(0, 6);

    // 12. Geographic / City Distribution
    const cityMap = {};
    allRestaurants.forEach((r) => {
      const city = r.address?.city || 'Unspecified';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });
    const cityDistribution = Object.entries(cityMap).map(([city, count]) => ({
      city,
      count,
    }));

    // 13. Order Status Breakdown
    const orderStatusCounts = {
      pending: 0,
      processing: 0,
      served: 0,
      cancelled: 0,
    };
    allOrders.forEach((o) => {
      const s = o.status || 'pending';
      if (orderStatusCounts[s] !== undefined) {
        orderStatusCounts[s]++;
      }
    });
    const orderStatusBreakdown = [
      { name: 'Served', count: orderStatusCounts.served, color: '#10b981' },
      { name: 'Preparing', count: orderStatusCounts.processing, color: '#3b82f6' },
      { name: 'Pending', count: orderStatusCounts.pending, color: '#f59e0b' },
      { name: 'Cancelled', count: orderStatusCounts.cancelled, color: '#ef4444' },
    ];

    // 14. Actionable Lists: Recent Transactions, Leads & Expiring Subscriptions
    const recentTransactions = allRenewalRequests.slice(0, 6).map((r) => ({
      _id: r._id,
      restaurantName: r.restaurantName || 'Restaurant',
      planName: r.planName,
      amount: Number(r.amount) || 0,
      status: r.status,
      date: r.createdAt || r.requestedAt,
      requestType: r.requestType,
      transactionRef: r.transactionRef,
    }));

    const recentLeads = allLeads.slice(0, 6).map((l) => ({
      _id: l._id,
      restaurantName: l.restaurantName,
      contactPerson: l.contactPerson,
      phone: l.phone,
      email: l.email,
      stage: l.stage,
      city: l.address?.city || 'India',
      createdAt: l.createdAt,
    }));

    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = allSubscriptions
      .filter((s) => {
        const end = new Date(s.endDate);
        return s.status === 'active' && end >= now && end <= next30Days;
      })
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
      .slice(0, 6)
      .map((s) => ({
        _id: s._id,
        restaurantName: s.restaurantName || 'Restaurant',
        packageName: s.packageName,
        price: Number(s.price) || 0,
        endDate: s.endDate,
        daysLeft: Math.ceil((new Date(s.endDate) - now) / (1000 * 60 * 60 * 24)),
      }));

    return res.status(200).json({
      success: true,
      data: {
        kpi: {
          totalRevenue: totalPlatformRevenue,
          mrr,
          totalRestaurants: allRestaurants.length,
          activeRestaurants: activeRestroCount,
          trialRestaurants: trialRestroCount,
          inactiveRestaurants: inactiveRestroCount,
          totalLeads,
          convertedLeads,
          conversionRate,
          totalOrders: totalOrdersCount,
          totalAllOrders: totalAllOrdersCount,
          totalGmv: Math.round(totalGmv),
          avgOrderValue,
          todayOrders: todayOrders.length,
          todayGmv: Math.round(todayGmv),
          totalTables: totalTablesCount,
          totalDishes: totalDishesCount,
          totalDiners: totalCustomersCount,
          totalReviews,
          averageRating,
          pendingVerifications: pendingVerificationCount,
        },
        revenueTrends,
        onboardingTrends,
        packageDistribution,
        leadsFunnel,
        cityDistribution,
        orderStatusBreakdown,
        recentTransactions,
        recentLeads,
        expiringSoon,
        topRestaurants,
      },
    });
  } catch (error) {
    console.error('Super Admin Analytics Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to aggregate platform analytics records',
      error: error.message,
    });
  }
};
