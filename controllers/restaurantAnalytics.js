const mongoose = require('mongoose');
const Order = require('../models/Order');
const Session = require('../models/Session');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const MenuCategory = require('../models/MenuCategory');
const CustomerReview = require('../models/CustomerReview');
const Inquiry = require('../models/Inquiry');
const Offer = require('../models/Offer');

/**
 * Helper to build calendar day boundaries for the last N days
 */
function getLastNDays(numDays = 7) {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    days.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: dayNames[d.getDay()],
      shortDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      start: d,
      end: end,
    });
  }
  return days;
}

/**
 * GET /api/restaurant/analytics
 * Returns dynamic, real DB metrics and multi-module graph analytics.
 */
exports.getRestaurantAnalytics = async (req, res) => {
  try {
    const restaurantId = req.user?.restaurantId || req.query.restaurantId || req.headers['x-restaurant-id'];
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Restaurant ID missing from user context' });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);

    const last7Days = getLastNDays(7);
    const last30Days = getLastNDays(30);

    // 1. Parallel fetch across all relevant restaurant collections
    const [
      orders,
      sessions,
      tables,
      menuItems,
      menuCategories,
      reviews,
      inquiries,
      offers,
    ] = await Promise.all([
      Order.find({ restaurantId })
        .populate('tableId', 'tableNo tableId number section')
        .sort({ createdAt: -1 })
        .lean(),
      Session.find({ restaurantId })
        .populate('tableId', 'tableNo tableId number capacity section')
        .populate('orderIds')
        .sort({ startedAt: -1 })
        .lean(),
      Table.find({ restaurantId }).lean(),
      MenuItem.find({ restaurantId })
        .populate('categoryId', 'name')
        .lean(),
      MenuCategory.find({ restaurantId }).lean(),
      CustomerReview.find({ restaurantId }).sort({ createdAt: -1 }).lean(),
      Inquiry.find({ restaurantId }).sort({ submittedAt: -1 }).lean(),
      Offer.find({ restaurantId }).lean(),
    ]);

    // -----------------------------------------------------------------------
    // MODULE 1: ORDERS & REVENUE ANALYTICS
    // -----------------------------------------------------------------------
    let todayRevenue = 0;
    let todayOrdersCount = 0;
    let yesterdayRevenue = 0;
    let yesterdayOrdersCount = 0;
    let allTimeRevenue = 0;
    let pendingKotCount = 0;
    let qrOrdersCount = 0;
    let manualOrdersCount = 0;

    const orderStatusCounts = { pending: 0, processing: 0, served: 0, cancelled: 0 };
    const uniqueCustomers = new Set();
    const dishSalesMap = {}; // name -> { name, quantity, revenue, price, category, isVegetarian }

    orders.forEach((o) => {
      const orderDate = new Date(o.createdAt);
      const isCancelled = o.status === 'cancelled';
      const total = Number(o.total) || 0;

      // Status count
      if (orderStatusCounts[o.status] !== undefined) {
        orderStatusCounts[o.status]++;
      } else {
        orderStatusCounts[o.status] = 1;
      }

      // Source count
      if (o.source === 'manual') manualOrdersCount++;
      else qrOrdersCount++;

      // Customer count
      if (o.customer?.mobile) uniqueCustomers.add(o.customer.mobile);
      if (o.customerMobile) uniqueCustomers.add(o.customerMobile);

      // Active KOT
      if (['pending', 'processing'].includes(o.status)) {
        pendingKotCount++;
      }

      // Financials (exclude cancelled orders)
      if (!isCancelled) {
        allTimeRevenue += total;

        if (orderDate >= startOfToday) {
          todayRevenue += total;
          todayOrdersCount++;
        } else if (orderDate >= startOfYesterday && orderDate <= endOfYesterday) {
          yesterdayRevenue += total;
          yesterdayOrdersCount++;
        }

        // Aggregate dish sales from items
        (o.items || []).forEach((item) => {
          if (item.status === 'cancelled') return;
          const netQty = Math.max(0, (Number(item.quantity) || 1) - (Number(item.cancelledQty) || 0));
          if (netQty <= 0) return;

          const itemName = item.name || 'Dish Item';
          const itemPrice = Number(item.price) || 0;
          const itemRev = netQty * itemPrice;

          if (!dishSalesMap[itemName]) {
            dishSalesMap[itemName] = {
              name: itemName,
              salesCount: 0,
              revenue: 0,
              price: itemPrice,
              category: 'Main Course',
              isVegetarian: true,
            };
          }
          dishSalesMap[itemName].salesCount += netQty;
          dishSalesMap[itemName].revenue += itemRev;
        });
      }
    });

    const allNonCancelledOrders = orders.filter((o) => o.status !== 'cancelled');
    const allTimeOrders = allNonCancelledOrders.length;
    const todayAvgOrderValue = todayOrdersCount > 0 ? Math.round(todayRevenue / todayOrdersCount) : 0;

    // 7-Day & 30-Day Sales Velocity (Real Daily Data)
    const salesTrends = last7Days.map((d) => {
      const dayOrders = allNonCancelledOrders.filter((o) => {
        const oDate = new Date(o.createdAt);
        return oDate >= d.start && oDate <= d.end;
      });
      const dayRevenue = dayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      return {
        date: d.dayName,
        shortDate: d.shortDate,
        revenue: dayRevenue,
        orders: dayOrders.length,
      };
    });

    const salesTrends30 = last30Days.map((d) => {
      const dayOrders = allNonCancelledOrders.filter((o) => {
        const oDate = new Date(o.createdAt);
        return oDate >= d.start && oDate <= d.end;
      });
      const dayRevenue = dayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      return {
        date: d.shortDate,
        revenue: dayRevenue,
        orders: dayOrders.length,
      };
    });

    // 24-Hour Dining Rush Distribution (Hourly Flow)
    const hourlyDistributionMap = {};
    const businessHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    businessHours.forEach((h) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      hourlyDistributionMap[h] = {
        hour: `${displayH} ${period}`,
        rawHour: h,
        orders: 0,
        revenue: 0,
      };
    });

    allNonCancelledOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      if (hourlyDistributionMap[h]) {
        hourlyDistributionMap[h].orders++;
        hourlyDistributionMap[h].revenue += Number(o.total) || 0;
      }
    });
    const hourlyFlow = businessHours.map((h) => hourlyDistributionMap[h]);

    // Order Source Distribution Chart
    const orderSourceBreakdown = [
      { name: 'QR Scan Orders', count: qrOrdersCount, color: '#d9480f' },
      { name: 'Manual Waiter Orders', count: manualOrdersCount, color: '#3b82f6' },
    ];

    // Order Status Breakdown Chart
    const orderStatusBreakdown = [
      { name: 'Served', count: orderStatusCounts.served || 0, color: '#10b981' },
      { name: 'Processing', count: orderStatusCounts.processing || 0, color: '#f59e0b' },
      { name: 'Pending', count: orderStatusCounts.pending || 0, color: '#3b82f6' },
      { name: 'Cancelled', count: orderStatusCounts.cancelled || 0, color: '#ef4444' },
    ];

    // -----------------------------------------------------------------------
    // MODULE 2: TABLES & FLOOR MAP ANALYTICS
    // -----------------------------------------------------------------------
    const totalTablesCount = tables.length;
    const activeSessions = sessions.filter((s) => s.status === 'active');
    const activeSessionTableIdMap = {};

    activeSessions.forEach((s) => {
      const tId = s.tableId?._id?.toString() || s.tableId?.toString();
      if (tId) activeSessionTableIdMap[tId] = s;
      if (s.customerMobile) uniqueCustomers.add(s.customerMobile);
    });

    let freeTablesCount = 0;
    let diningTablesCount = 0;
    let billedTablesCount = 0;
    let inactiveTablesCount = 0;
    const sectionMap = {};

    let totalSeatCapacity = 0;
    let occupiedSeatCapacity = 0;

    tables.forEach((t) => {
      const cap = Number(t.capacity) || 4;
      totalSeatCapacity += cap;

      const secName = t.section || 'Main Hall';
      if (!sectionMap[secName]) {
        sectionMap[secName] = { section: secName, totalTables: 0, totalCapacity: 0, activeTables: 0 };
      }
      sectionMap[secName].totalTables++;
      sectionMap[secName].totalCapacity += cap;

      const tId = t._id.toString();
      const session = activeSessionTableIdMap[tId];

      if (t.status === 'inactive') {
        inactiveTablesCount++;
      } else if (!session) {
        freeTablesCount++;
      } else {
        occupiedSeatCapacity += cap;
        sectionMap[secName].activeTables++;

        if (session.billRequested || session.paymentStatus === 'pending' && (session.orderIds || []).length > 0) {
          billedTablesCount++;
        } else {
          diningTablesCount++;
        }
      }
    });

    const activeTablesCount = diningTablesCount + billedTablesCount;
    const occupancyRate = totalTablesCount > 0 ? Math.round((activeTablesCount / totalTablesCount) * 100) : 0;

    const tableStatusBreakdown = [
      { name: 'Free (Available)', count: freeTablesCount, color: '#10b981' },
      { name: 'Dining (Occupied)', count: diningTablesCount, color: '#3b82f6' },
      { name: 'Billed (Pay Pending)', count: billedTablesCount, color: '#f59e0b' },
      { name: 'Inactive', count: inactiveTablesCount, color: '#6b7280' },
    ];

    const sectionDistribution = Object.values(sectionMap);

    // -----------------------------------------------------------------------
    // MODULE 3: MENU & DISH PERFORMANCE ANALYTICS
    // -----------------------------------------------------------------------
    let vegCount = 0;
    let nonVegCount = 0;
    let eggCount = 0;
    let availableCount = 0;
    let unavailableCount = 0;

    const categoryItemCountMap = {};

    menuItems.forEach((item) => {
      if (item.status === 'available') availableCount++;
      else unavailableCount++;

      const fType = (item.foodType || '').toLowerCase();
      if (fType === 'non-veg') nonVegCount++;
      else if (fType === 'egg') eggCount++;
      else vegCount++;

      const catName = item.categoryId?.name || item.category || 'Main Course';
      categoryItemCountMap[catName] = (categoryItemCountMap[catName] || 0) + 1;

      // Enrich dishSalesMap with real menu item metadata if matched
      if (dishSalesMap[item.name]) {
        dishSalesMap[item.name].category = catName;
        dishSalesMap[item.name].isVegetarian = fType !== 'non-veg';
        dishSalesMap[item.name].price = item.price || dishSalesMap[item.name].price;
      }
    });

    const categoryColors = ['#d9480f', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#14b8a6'];
    const categoryDistribution = Object.keys(categoryItemCountMap).map((catName, idx) => ({
      name: catName,
      count: categoryItemCountMap[catName],
      color: categoryColors[idx % categoryColors.length],
    }));

    const foodTypeDistribution = [
      { name: 'Vegetarian', count: vegCount, color: '#10b981' },
      { name: 'Non-Vegetarian', count: nonVegCount, color: '#ef4444' },
      { name: 'Contains Egg', count: eggCount, color: '#f59e0b' },
    ].filter((f) => f.count > 0);

    // Top Selling Dishes (Calculated from REAL orders, fallback to menu items if no orders yet)
    let topDishes = Object.values(dishSalesMap)
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5);

    if (topDishes.length === 0) {
      topDishes = menuItems.slice(0, 5).map((item) => ({
        name: item.name,
        category: item.categoryId?.name || 'Main Course',
        price: item.price || 0,
        salesCount: 0,
        revenue: 0,
        isVegetarian: item.foodType !== 'non-veg',
      }));
    }

    // -----------------------------------------------------------------------
    // MODULE 4: PAYMENT MODES & BILLING
    // -----------------------------------------------------------------------
    const paymentMap = {
      cash: { method: 'Cash', count: 0, amount: 0, color: '#10b981' },
      upi: { method: 'UPI', count: 0, amount: 0, color: '#8b5cf6' },
      card: { method: 'Card', count: 0, amount: 0, color: '#3b82f6' },
      online: { method: 'Online / Net Banking', count: 0, amount: 0, color: '#f59e0b' },
      other: { method: 'Other', count: 0, amount: 0, color: '#6b7280' },
    };

    sessions.forEach((s) => {
      const method = s.paymentMethod || 'cash';
      const amt = Number(s.total) || 0;
      if (paymentMap[method]) {
        paymentMap[method].count++;
        paymentMap[method].amount += amt;
      } else {
        paymentMap.other.count++;
        paymentMap.other.amount += amt;
      }
    });

    const paymentModesBreakdown = Object.values(paymentMap).filter((p) => p.count > 0 || p.amount > 0);

    // -----------------------------------------------------------------------
    // MODULE 5: CUSTOMER REVIEWS & RATINGS
    // -----------------------------------------------------------------------
    const totalReviews = reviews.length;
    let averageRating = 5.0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const reviewStatusCounts = { accepted: 0, pending: 0, rejected: 0 };

    if (totalReviews > 0) {
      let sumStars = 0;
      reviews.forEach((r) => {
        const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
        sumStars += rating;
        starCounts[rating] = (starCounts[rating] || 0) + 1;

        const st = r.status || 'pending';
        reviewStatusCounts[st] = (reviewStatusCounts[st] || 0) + 1;
      });
      averageRating = Number((sumStars / totalReviews).toFixed(1));
    }

    const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
      star: `${stars} Star${stars > 1 ? 's' : ''}`,
      stars,
      count: starCounts[stars] || 0,
      percentage: totalReviews > 0 ? Math.round(((starCounts[stars] || 0) / totalReviews) * 100) : 0,
    }));

    const recentReviews = reviews.slice(0, 4).map((r) => ({
      _id: r._id,
      customerName: r.customerName || 'Diner',
      rating: r.rating || 5,
      comment: r.comment || '',
      tableName: r.tableName || 'Table',
      submittedAt: r.submittedAt || r.createdAt,
    }));

    // -----------------------------------------------------------------------
    // MODULE 6: WEBSITE INQUIRIES & OFFERS
    // -----------------------------------------------------------------------
    const inquiryStatusCounts = { new: 0, in_progress: 0, resolved: 0 };
    inquiries.forEach((inq) => {
      const st = inq.status || 'new';
      inquiryStatusCounts[st] = (inquiryStatusCounts[st] || 0) + 1;
    });

    const inquiryStatusBreakdown = [
      { name: 'New Inquiries', count: inquiryStatusCounts.new || 0, color: '#3b82f6' },
      { name: 'In Progress', count: inquiryStatusCounts.in_progress || 0, color: '#f59e0b' },
      { name: 'Resolved', count: inquiryStatusCounts.resolved || 0, color: '#10b981' },
    ];

    const activeOffersCount = offers.filter((o) => o.status === 'active').length;
    const totalTimesAvailed = offers.reduce((sum, o) => sum + (o.performance?.timesAvailed || 0), 0);
    const totalDiscountGiven = offers.reduce((sum, o) => sum + (o.performance?.totalDiscountGiven || 0), 0);

    // -----------------------------------------------------------------------
    // RECENT OPERATIONAL RECORDS FOR LIVE WIDGETS
    // -----------------------------------------------------------------------
    const formattedActiveSessions = activeSessions.slice(0, 6).map((s) => {
      const start = new Date(s.startedAt || s.createdAt);
      const elapsedMins = Math.max(1, Math.round((now - start) / (1000 * 60)));
      const tableName = s.tableId?.tableNo || s.tableId?.tableId || (s.tableId?.number ? `Table ${s.tableId.number}` : 'Table');

      return {
        _id: s._id,
        tableName,
        customerName: s.customerName || 'Walk-in Diner',
        customerMobile: s.customerMobile || '',
        itemCount: (s.orderIds || []).reduce((sum, o) => sum + (o.items?.length || 0), 0),
        totalAmount: s.total || s.subtotal || 0,
        elapsedMins,
        status: s.status,
      };
    });

    const recentOrders = orders.slice(0, 6).map((o) => {
      const tableName = o.tableId?.tableNo || o.tableId?.tableId || (o.tableId?.number ? `Table ${o.tableId.number}` : 'Table');
      const itemsPreview = (o.items || [])
        .map((i) => `${i.quantity || 1}x ${i.name}`)
        .join(', ');

      return {
        _id: o._id,
        orderNumber: o.orderNumber || 'ORD',
        tableName,
        itemsCount: (o.items || []).length,
        itemsPreview: itemsPreview || 'Item order',
        total: o.total || 0,
        source: o.source || 'qr',
        status: o.status,
        createdAt: o.createdAt,
      };
    });

    // Final response payload
    return res.status(200).json({
      success: true,
      data: {
        kpi: {
          todayRevenue,
          todayOrders: todayOrdersCount,
          todayAvgOrderValue,
          yesterdayRevenue,
          yesterdayOrders: yesterdayOrdersCount,
          activeTables: activeTablesCount,
          totalTables: totalTablesCount,
          occupancyRate,
          allTimeRevenue,
          allTimeOrders,
          totalDiners: uniqueCustomers.size,
          averageRating,
          pendingKOT: pendingKotCount,
          totalDishes: menuItems.length,
          availableDishes: availableCount,
          totalReviews,
          totalInquiries: inquiries.length,
          totalOffers: offers.length,
          totalSeatCapacity,
          occupiedSeatCapacity,
        },
        // Module 1: Orders & Sales
        salesTrends,
        salesTrends30,
        hourlyFlow,
        orderSourceBreakdown,
        orderStatusBreakdown,
        // Module 2: Tables & Floor
        tableStatusBreakdown,
        sectionDistribution,
        activeSessions: formattedActiveSessions,
        // Module 3: Menu & Culinary
        categoryDistribution,
        foodTypeDistribution,
        topDishes,
        // Module 4: Payments
        paymentModesBreakdown,
        // Module 5: Customer Reviews
        ratingDistribution,
        recentReviews,
        // Module 6: Inquiries & Offers
        inquiryStatusBreakdown,
        offersSummary: {
          totalOffers: offers.length,
          activeOffers: activeOffersCount,
          totalTimesAvailed,
          totalDiscountGiven,
        },
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Error in getRestaurantAnalytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restaurant analytics',
      error: error.message,
    });
  }
};
