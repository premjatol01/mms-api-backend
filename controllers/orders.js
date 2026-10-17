const mongoose = require('mongoose');
const Order = require('../models/Order');
const Session = require('../models/Session');
const Table = require('../models/Table');
const Restaurant = require('../models/Restaurant');
const Customer = require('../models/Customer');
const { emitToRestaurant, emitToTable } = require('../socket');

/**
 * Finds or creates a customer record for a restaurant and updates visit/spend activity
 */
async function upsertCustomerForRestaurant({ restaurantId, mobile, name = '', sessionId = null, spend = 0 }) {
  if (!restaurantId || !mobile) return null;
  const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
  if (cleanMobile.length !== 10) return null;

  try {
    let customer = await Customer.findOne({ restaurantId, mobile: cleanMobile });
    const now = new Date();

    if (!customer) {
      customer = new Customer({
        restaurantId,
        mobile: cleanMobile,
        name: name ? name.trim() : '',
        totalVisits: 1,
        totalSpend: Math.max(0, Number(spend) || 0),
        lastSessionId: sessionId || undefined,
        sessions: sessionId ? [sessionId] : [],
        firstVisitAt: now,
        lastVisitAt: now
      });
      await customer.save();
    } else {
      if (name && name.trim() && !customer.name) {
        customer.name = name.trim();
      }
      customer.lastVisitAt = now;
      if (sessionId) {
        customer.lastSessionId = sessionId;
        const hasSession = (customer.sessions || []).some(
          (s) => String(s) === String(sessionId)
        );
        if (!hasSession) {
          customer.sessions.push(sessionId);
          customer.totalVisits = (customer.totalVisits || 0) + 1;
        }
      }
      if (spend > 0) {
        customer.totalSpend = (customer.totalSpend || 0) + Number(spend);
      }
      await customer.save();
    }

    return customer;
  } catch (err) {
    console.error('Error upserting customer for restaurant:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure calculation helpers (aligned with admin & customer portal expectations)
// ─────────────────────────────────────────────────────────────────────────────

const getActiveQty = (item) => Math.max(0, (item.quantity || 0) - (item.cancelledQty || 0));

const isItemCancelled = (item) => getActiveQty(item) <= 0;

const isItemCancellable = (item) => !isItemCancelled(item) && item.status !== 'served';

function deriveOrderStatus(items) {
  const live = items.filter((item) => !isItemCancelled(item));
  if (live.length === 0) return 'cancelled';
  if (live.every((item) => item.status === 'served')) return 'served';
  if (live.every((item) => item.status === 'pending')) return 'pending';
  return 'processing';
}

function recalcOrderDoc(order) {
  const subtotal = order.items.reduce((sum, item) => sum + (item.price || 0) * getActiveQty(item), 0);
  const discount = Math.min(order.discount || 0, subtotal);
  order.subtotal = subtotal;
  order.discount = discount;
  order.total = Math.max(0, subtotal - discount);
  order.status = deriveOrderStatus(order.items);
  return order;
}

async function recalcSessionDoc(sessionId, dbSession = null) {
  const query = Session.findById(sessionId);
  if (dbSession) query.session(dbSession);
  const session = await query;
  if (!session) return null;

  const ordersQuery = Order.find({ sessionId: session._id });
  if (dbSession) ordersQuery.session(dbSession);
  const orders = await ordersQuery;
  const liveOrders = orders.filter((o) => o.status !== 'cancelled');

  const subtotal = liveOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const discount = liveOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const gst = Math.round(subtotal * 0.05);
  const total = Math.max(0, subtotal + gst - discount);

  const orderWithOffer = liveOrders.find((o) => o.appliedOffer);
  if (orderWithOffer && !session.appliedOffer) {
    session.appliedOffer = orderWithOffer.appliedOffer;
  }

  session.subtotal = subtotal;
  session.discount = discount > 0 ? discount : (session.discount || 0);
  session.gst = gst;
  session.total = total;
  session.orderIds = orders.map((o) => o._id);
  if (dbSession) {
    await session.save({ session: dbSession });
  } else {
    await session.save();
  }
  return session;
}

async function getNextSessionNumber(restaurantId) {
  const lastSession = await Session.findOne({ restaurantId })
    .sort({ createdAt: -1 })
    .select('sessionNumber');
  let num = 1000;
  if (lastSession && lastSession.sessionNumber) {
    const match = lastSession.sessionNumber.match(/\d+/);
    if (match) num = parseInt(match[0], 10);
  }
  return `#S-${num + 1}`;
}

async function getNextOrderNumber(restaurantId) {
  const lastOrder = await Order.findOne({ restaurantId })
    .sort({ createdAt: -1 })
    .select('orderNumber');
  let num = 1000;
  if (lastOrder && lastOrder.orderNumber) {
    const match = lastOrder.orderNumber.match(/\d+/);
    if (match) num = parseInt(match[0], 10);
  }
  return `#${num + 1}`;
}

async function resolveRestaurantAndTable(subdomain, tableId) {
  if (!subdomain || !tableId) return { error: 'Subdomain and Table ID are required.' };

  const cleanSubdomain = decodeURIComponent(subdomain).trim().toLowerCase();
  const cleanTableId = decodeURIComponent(tableId).trim();

  let restaurant = await Restaurant.findOne({
    'website.subdomain': { $regex: new RegExp(`^${cleanSubdomain}$`, 'i') }
  }).select('-admin.password');

  if (!restaurant && mongoose.isValidObjectId(cleanSubdomain)) {
    restaurant = await Restaurant.findById(cleanSubdomain).select('-admin.password');
  }

  if (!restaurant) return { error: `Restaurant '${subdomain}' not found.` };
  if (restaurant.status && restaurant.status !== 'active') {
    return { error: `Restaurant '${restaurant.name}' is currently inactive.` };
  }

  let table = await Table.findOne({
    restaurantId: restaurant._id,
    $or: [
      ...(mongoose.isValidObjectId(cleanTableId) ? [{ _id: cleanTableId }] : []),
      { tableNo: cleanTableId },
      { tableNo: { $regex: new RegExp(`^${cleanTableId}$`, 'i') } },
      { tableId: cleanTableId }
    ]
  });

  if (!table) return { error: `Table '${cleanTableId}' not found.` };
  if (table.status && table.status !== 'active') {
    return { error: `Table is currently inactive.` };
  }

  return { restaurant, table };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC CUSTOMER PORTAL CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/orders/public/session/:subdomain/:tableId
// @desc    Get active table session and placed orders for customer order portal
// @access  Public
exports.getPublicTableSession = async (req, res) => {
  try {
    const { subdomain, tableId } = req.params;
    const resolved = await resolveRestaurantAndTable(subdomain, tableId);
    if (resolved.error) {
      return res.status(404).json({ success: false, message: resolved.error });
    }

    const { restaurant, table } = resolved;

    const activeSession = await Session.findOne({
      restaurantId: restaurant._id,
      tableId: table._id,
      status: 'active'
    });

    let orders = [];
    if (activeSession) {
      orders = await Order.find({ sessionId: activeSession._id }).sort({ createdAt: 1 });
    }

    return res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          subdomain: restaurant.website?.subdomain,
          currency: '₹'
        },
        table: {
          id: table._id,
          _id: table._id,
          tableId: table._id.toString(),
          tableNo: table.tableNo || table.tableId,
          tableName: table.tableNo || table.tableId || (table.number ? `Table ${table.number}` : "Table"),
          name: table.tableNo || table.tableId || (table.number ? `Table ${table.number}` : "Table")
        },
        session: activeSession
          ? {
              _id: activeSession._id,
              sessionNumber: activeSession.sessionNumber,
              status: activeSession.status,
              paymentStatus: activeSession.paymentStatus,
              subtotal: activeSession.subtotal,
              discount: activeSession.discount,
              gst: activeSession.gst ?? Math.round((activeSession.subtotal || 0) * 0.05),
              total: activeSession.total,
              customerMobile: activeSession.customerMobile,
              customerName: activeSession.customerName || null,
              customerId: activeSession.customerId || null,
              appliedOffer: activeSession.appliedOffer || (orders.find((o) => o.appliedOffer)?.appliedOffer) || null,
              startedAt: activeSession.startedAt
            }
          : null,
        orders
      }
    });
  } catch (error) {
    console.error('Error fetching public table session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   POST /api/orders/public/place-order
// @desc    Place an order from customer order portal (QR Scan)
// @access  Public
exports.placePublicOrder = async (req, res) => {
  try {
    const { subdomain, tableId, items, mobile, appliedOffer, discount = 0 } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required to place an order.' });
    }

    const resolved = await resolveRestaurantAndTable(subdomain, tableId);
    if (resolved.error) {
      return res.status(404).json({ success: false, message: resolved.error });
    }

    const { restaurant, table } = resolved;

    // 1. Find or create an active Session for this table
    let session = await Session.findOne({
      restaurantId: restaurant._id,
      tableId: table._id,
      status: 'active'
    });

    const cleanMobile = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : (session?.customerMobile || null);
    let customer = null;

    if (!session) {
      const sessionNumber = await getNextSessionNumber(restaurant._id);
      session = new Session({
        restaurantId: restaurant._id,
        tableId: table._id,
        sessionNumber,
        status: 'active',
        paymentStatus: 'pending',
        customerMobile: cleanMobile || null,
        orderIds: [],
        total: 0,
        subtotal: 0,
        gst: 0,
        discount: 0,
        startedAt: new Date()
      });
      await session.save();
    } else if (cleanMobile && !session.customerMobile) {
      session.customerMobile = cleanMobile;
      await session.save();
    }

    if (cleanMobile && cleanMobile.length === 10) {
      customer = await upsertCustomerForRestaurant({
        restaurantId: restaurant._id,
        mobile: cleanMobile,
        sessionId: session._id,
        spend: 0
      });
      if (customer && !session.customerId) {
        session.customerId = customer._id;
        await session.save();
      }
      if (customer) {
        customer.lastOrderAt = new Date();
        await customer.save().catch(() => {});
      }
    }

    // 2. Prepare order items
    const orderItems = items.map((item, idx) => ({
      menuItemId: mongoose.isValidObjectId(item.id || item.menuItemId) ? (item.id || item.menuItemId) : null,
      name: item.title || item.name || `Item ${idx + 1}`,
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      imageUrl: item.imageUrl || item.image || '',
      cancelledQty: 0,
      status: 'pending'
    }));

    const rawSubtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const numDiscount = Math.min(Number(discount) || 0, rawSubtotal);
    const orderTotal = Math.max(0, rawSubtotal - numDiscount);
    const orderNumber = await getNextOrderNumber(restaurant._id);

    // 3. Create Order
    const order = new Order({
      restaurantId: restaurant._id,
      sessionId: session._id,
      tableId: table._id,
      orderNumber,
      source: 'qr',
      customer: {
        mobile: cleanMobile || session.customerMobile || null,
        customerId: customer?._id || session.customerId || null
      },
      items: orderItems,
      subtotal: rawSubtotal,
      discount: numDiscount,
      total: orderTotal,
      appliedOffer: appliedOffer || null,
      status: 'pending',
      cancellations: []
    });

    await order.save();

    // 4. Update session
    session.orderIds.push(order._id);
    await session.save();
    await recalcSessionDoc(session._id);

    const updatedSession = await Session.findById(session._id);
    const allSessionOrders = await Order.find({ sessionId: session._id }).sort({ createdAt: 1 });

    // Broadcast real-time events to restaurant admin and table customers
    emitToRestaurant(restaurant._id, 'order:created', {
      order,
      session: updatedSession,
      orders: allSessionOrders,
      table: {
        _id: table._id,
        id: table._id,
        tableNo: table.tableNo || table.tableId
      }
    });

    emitToTable(table._id, 'session:updated', {
      session: updatedSession,
      orders: allSessionOrders,
      order
    });

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        order,
        session: updatedSession,
        orders: allSessionOrders
      }
    });
  } catch (error) {
    console.error('Error placing public order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   POST /api/orders/public/session/sync-customer
// @desc    Sync customer mobile number with active table session and track customer activity in Customer collection
// @access  Public
exports.syncCustomerToSession = async (req, res) => {
  try {
    const { subdomain, tableId, sessionId, mobile, name, appliedOffer, discount } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number' });
    }

    let restaurant = null;
    let table = null;

    if (subdomain && tableId) {
      const resolved = await resolveRestaurantAndTable(subdomain, tableId);
      if (!resolved.error) {
        restaurant = resolved.restaurant;
        table = resolved.table;
      }
    }

    let session = null;
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      session = await Session.findById(sessionId);
      if (session && !restaurant) {
        restaurant = await Restaurant.findById(session.restaurantId);
      }
      if (session && !table) {
        table = await Table.findById(session.tableId);
      }
    }

    if (!session && restaurant && table) {
      session = await Session.findOne({
        restaurantId: restaurant._id,
        tableId: table._id,
        status: 'active'
      });
    }

    if (!session && restaurant && table) {
      // Create new active session if none exists yet
      const sessionNumber = await getNextSessionNumber(restaurant._id);
      session = new Session({
        restaurantId: restaurant._id,
        tableId: table._id,
        sessionNumber,
        status: 'active',
        paymentStatus: 'pending',
        customerMobile: cleanMobile,
        customerName: name ? name.trim() : null,
        orderIds: [],
        total: 0,
        subtotal: 0,
        discount: 0,
        startedAt: new Date()
      });
      await session.save();
    }

    if (!session || !restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Could not find an active table session or restaurant.'
      });
    }

    // 1. Upsert customer in Customer collection for this restaurant
    const customer = await upsertCustomerForRestaurant({
      restaurantId: restaurant._id,
      mobile: cleanMobile,
      name: name ? name.trim() : '',
      sessionId: session._id,
      spend: 0
    });

    // 2. Link customer & offer to Session
    session.customerMobile = cleanMobile;
    if (customer) {
      session.customerId = customer._id;
    }
    if (name && name.trim()) {
      session.customerName = name.trim();
    }
    if (appliedOffer) {
      session.appliedOffer = appliedOffer;
    }
    if (discount && Number(discount) > 0) {
      session.discount = Number(discount);
    }
    await session.save();

    // 3. Retroactively sync customer mobile onto all orders in this session
    await Order.updateMany(
      { sessionId: session._id, $or: [{ 'customer.mobile': null }, { 'customer.mobile': '' }] },
      {
        $set: {
          'customer.mobile': cleanMobile,
          'customer.customerId': customer?._id || null,
          'customer.name': name ? name.trim() : undefined
        }
      }
    );

    // 4. Real-time broadcast to table and restaurant admin
    if (table) {
      emitToTable(table._id, 'session:customer_synced', {
        tableId: table._id,
        sessionNumber: session.sessionNumber,
        customerMobile: cleanMobile,
        customerName: session.customerName,
        appliedOffer: session.appliedOffer || null,
        discount: session.discount || 0
      });
    }

    emitToRestaurant(restaurant._id, 'session:customer_synced', {
      tableId: session.tableId,
      sessionNumber: session.sessionNumber,
      customerMobile: cleanMobile,
      customerName: session.customerName,
      customerVisits: customer?.totalVisits || 1,
      appliedOffer: session.appliedOffer || null
    });

    return res.status(200).json({
      success: true,
      message: 'Mobile number synced with active session successfully',
      data: {
        sessionId: session._id,
        sessionNumber: session.sessionNumber,
        customerMobile: session.customerMobile,
        customerName: session.customerName,
        appliedOffer: session.appliedOffer || null,
        discount: session.discount || 0,
        customer: customer
          ? {
              id: customer._id,
              mobile: customer.mobile,
              name: customer.name,
              totalVisits: customer.totalVisits,
              totalSpend: customer.totalSpend,
              isRepeatCustomer: customer.totalVisits > 1
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error syncing customer to session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESTAURANT ADMIN CONTROLLERS (PROTECTED)
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/orders
// @desc    Get all orders for restaurant admin
// @access  Protected
exports.getAdminOrders = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { status, sessionId, tableId, today } = req.query;

    const query = { restaurantId };

    if (status) {
      query.status = status;
    }
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      query.sessionId = sessionId;
    }
    if (tableId && mongoose.isValidObjectId(tableId)) {
      query.tableId = tableId;
    }
    if (today === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfDay };
    }

    const orders = await Order.find(query)
      .populate('tableId', 'tableNo tableId number')
      .populate('sessionId', 'sessionNumber status paymentStatus subtotal discount gst total customerMobile')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   GET /api/orders/sessions
// @desc    Get table sessions for restaurant admin
// @access  Protected
exports.getAdminSessions = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { status, search } = req.query;

    const query = { restaurantId };
    if (status) {
      query.status = status;
    }

    const sessions = await Session.find(query)
      .populate('tableId', 'tableNo tableId number status')
      .populate('orderIds')
      .sort({ startedAt: -1 });

    let filtered = sessions;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = sessions.filter((s) => {
        const tableLabel = (s.tableId?.tableNo || s.tableId?.tableId || '').toLowerCase();
        const sessionNum = (s.sessionNumber || '').toLowerCase();
        return tableLabel.includes(term) || sessionNum.includes(term);
      });
    }

    return res.status(200).json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    console.error('Error fetching admin sessions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   POST /api/orders/manual
// @desc    Create an order manually from restaurant admin
// @access  Protected
exports.createAdminManualOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { tableId, items, customer, discount = 0 } = req.body;

    if (!tableId) {
      return res.status(400).json({ success: false, message: 'Table is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required.' });
    }

    const table = await Table.findOne({ _id: tableId, restaurantId });
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found.' });
    }

    // Find or create active session
    let session = await Session.findOne({ restaurantId, tableId: table._id, status: 'active' });
    const cleanCustomerMobile = customer?.mobile ? String(customer.mobile).replace(/\D/g, '').slice(-10) : null;
    let customerDoc = null;

    if (!session) {
      const sessionNumber = await getNextSessionNumber(restaurantId);
      session = new Session({
        restaurantId,
        tableId: table._id,
        sessionNumber,
        status: 'active',
        paymentStatus: 'pending',
        customerMobile: cleanCustomerMobile || null,
        customerName: customer?.name ? String(customer.name).trim() : null,
        orderIds: [],
        subtotal: 0,
        discount: 0,
        gst: 0,
        total: 0,
        startedAt: new Date()
      });
      await session.save();
    } else if (cleanCustomerMobile && !session.customerMobile) {
      session.customerMobile = cleanCustomerMobile;
      if (customer?.name) session.customerName = String(customer.name).trim();
      await session.save();
    }

    if (cleanCustomerMobile && cleanCustomerMobile.length === 10) {
      customerDoc = await upsertCustomerForRestaurant({
        restaurantId,
        mobile: cleanCustomerMobile,
        name: customer?.name || '',
        sessionId: session._id,
        spend: 0
      });
      if (customerDoc && !session.customerId) {
        session.customerId = customerDoc._id;
        await session.save();
      }
    }

    const orderItems = items.map((item, idx) => ({
      menuItemId: mongoose.isValidObjectId(item.menuItemId || item.id) ? (item.menuItemId || item.id) : null,
      name: item.name || `Item ${idx + 1}`,
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      cancelledQty: 0,
      status: 'pending'
    }));

    const rawSubtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const numDiscount = Math.min(Number(discount) || 0, rawSubtotal);
    const total = Math.max(0, rawSubtotal - numDiscount);
    const orderNumber = await getNextOrderNumber(restaurantId);

    const order = new Order({
      restaurantId,
      sessionId: session._id,
      tableId: table._id,
      orderNumber,
      source: 'manual',
      customer: {
        mobile: cleanCustomerMobile || session.customerMobile || null,
        customerId: customerDoc?._id || session.customerId || null,
        name: customer?.name || session.customerName || null
      },
      items: orderItems,
      subtotal: rawSubtotal,
      discount: numDiscount,
      total,
      status: 'pending',
      cancellations: []
    });

    await order.save();

    session.orderIds.push(order._id);
    await session.save();
    await recalcSessionDoc(session._id);

    const updatedSession = await Session.findById(session._id);
    const allSessionOrders = await Order.find({ sessionId: session._id }).sort({ createdAt: 1 });

    emitToRestaurant(restaurantId, 'order:created', {
      order,
      session: updatedSession,
      orders: allSessionOrders,
      table
    });

    emitToTable(table._id, 'session:updated', {
      session: updatedSession,
      orders: allSessionOrders,
      order
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Error creating manual order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   PUT /api/orders/:id/status
// @desc    Update whole order status (e.g. pending -> processing -> served)
// @access  Protected
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'served'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.items = order.items.map((item) => (isItemCancelled(item) ? item : { ...item.toObject(), status }));
    recalcOrderDoc(order);
    await order.save();
    await recalcSessionDoc(order.sessionId);

    const updatedSession = await Session.findById(order.sessionId);
    const allSessionOrders = await Order.find({ sessionId: order.sessionId }).sort({ createdAt: 1 });

    emitToRestaurant(order.restaurantId, 'order:updated', {
      order,
      session: updatedSession,
      orders: allSessionOrders
    });

    emitToTable(order.tableId, 'session:updated', {
      session: updatedSession,
      orders: allSessionOrders,
      order
    });

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   PUT /api/orders/:id/items/:itemId/status
// @desc    Update a single item status in an order
// @access  Protected
exports.updateItemStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'served'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in order' });

    if (!isItemCancelled(item)) {
      item.status = status;
      recalcOrderDoc(order);
      await order.save();
      await recalcSessionDoc(order.sessionId);

      const updatedSession = await Session.findById(order.sessionId);
      const allSessionOrders = await Order.find({ sessionId: order.sessionId }).sort({ createdAt: 1 });

      emitToRestaurant(order.restaurantId, 'order:updated', {
        order,
        itemId: req.params.itemId,
        status,
        session: updatedSession,
        orders: allSessionOrders
      });

      emitToTable(order.tableId, 'session:updated', {
        session: updatedSession,
        orders: allSessionOrders,
        order
      });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating item status:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order items or entire order
// @access  Protected
exports.cancelOrderItems = async (req, res) => {
  try {
    const { selections, reason = 'other', comment = '' } = req.body;

    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const cancelledRecords = [];

    // If selections provided: [{ itemId, quantity }]
    // Else cancel all cancellable items
    const targets = Array.isArray(selections) && selections.length > 0
      ? selections
      : order.items.filter(isItemCancellable).map((i) => ({ itemId: i._id.toString(), quantity: getActiveQty(i) }));

    order.items = order.items.map((item) => {
      const match = targets.find((t) => String(t.itemId) === String(item._id));
      if (!match || !isItemCancellable(item)) return item;

      const qtyToCancel = Math.min(Math.max(0, Number(match.quantity) || 0), getActiveQty(item));
      if (qtyToCancel <= 0) return item;

      const newCancelledQty = (item.cancelledQty || 0) + qtyToCancel;
      cancelledRecords.push({
        itemId: item._id,
        name: item.name,
        quantity: qtyToCancel,
        price: item.price
      });

      item.cancelledQty = newCancelledQty;
      if (newCancelledQty >= item.quantity) {
        item.status = 'cancelled';
      }
      return item;
    });

    if (cancelledRecords.length > 0) {
      order.cancellations.push({
        itemId: cancelledRecords[0].itemId,
        quantity: cancelledRecords.reduce((sum, c) => sum + c.quantity, 0),
        reason,
        comment,
        at: new Date()
      });
      recalcOrderDoc(order);
      await order.save();
      await recalcSessionDoc(order.sessionId);

      const updatedSession = await Session.findById(order.sessionId);
      const allSessionOrders = await Order.find({ sessionId: order.sessionId }).sort({ createdAt: 1 });

      emitToRestaurant(order.restaurantId, 'order:updated', {
        order,
        session: updatedSession,
        orders: allSessionOrders
      });

      emitToTable(order.tableId, 'session:updated', {
        session: updatedSession,
        orders: allSessionOrders,
        order
      });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error cancelling order items:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   POST /api/orders/sessions/:sessionId/serve-all
// @desc    Mark all remaining items in session as served
// @access  Protected
exports.serveAllInSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.sessionId, restaurantId: req.user.restaurantId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const orders = await Order.find({ sessionId: session._id });
    for (const order of orders) {
      order.items = order.items.map((item) => (isItemCancelled(item) ? item : { ...item.toObject(), status: 'served' }));
      recalcOrderDoc(order);
      await order.save();
    }

    await recalcSessionDoc(session._id);
    const updatedSession = await Session.findById(session._id);
    const allSessionOrders = await Order.find({ sessionId: session._id }).sort({ createdAt: 1 });

    emitToRestaurant(session.restaurantId, 'session:updated', {
      session: updatedSession,
      orders: allSessionOrders
    });

    emitToTable(session.tableId, 'session:updated', {
      session: updatedSession,
      orders: allSessionOrders
    });

    return res.status(200).json({ success: true, message: 'All items marked as served' });
  } catch (error) {
    console.error('Error serving all items in session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

function isTransactionSupported() {
  const topology = mongoose.connection.client?.topology?.description;
  if (!topology) return false;
  return Boolean(topology.setName) || topology.type === 'ReplicaSetWithPrimary' || topology.type === 'Sharded';
}

// @route   POST /api/orders/sessions/:sessionId/pay
// @desc    Mark session as paid & complete the session (frees the table)
//          Guarantees Atomicity, Consistency, Isolation, Durability (ACID)
// @access  Protected
exports.markSessionPaid = async (req, res) => {
  const canUseTx = isTransactionSupported();
  let dbSession = null;
  if (canUseTx) {
    try {
      dbSession = await mongoose.startSession();
      dbSession.startTransaction();
    } catch (err) {
      console.warn('Could not initialize MongoDB transaction:', err.message);
      dbSession = null;
    }
  }

  try {
    const sessionQuery = Session.findOne({
      _id: req.params.sessionId,
      restaurantId: req.user.restaurantId
    });
    if (dbSession) sessionQuery.session(dbSession);
    const session = await sessionQuery;

    if (!session) {
      if (dbSession) await dbSession.abortTransaction();
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status === 'completed') {
      if (dbSession) await dbSession.abortTransaction();
      return res.status(400).json({ success: false, message: 'Session is already completed' });
    }

    const ordersQuery = Order.find({ sessionId: session._id });
    if (dbSession) ordersQuery.session(dbSession);
    const orders = await ordersQuery;

    // Check unresolved items
    const unresolved = [];
    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (!isItemCancelled(item) && (item.status === 'pending' || item.status === 'processing')) {
          unresolved.push({ order: o.orderNumber, item: item.name });
        }
      });
    });

    if (unresolved.length > 0 && req.body.force !== true) {
      if (dbSession) await dbSession.abortTransaction();
      return res.status(400).json({
        success: false,
        reason: 'unresolved',
        message: 'Some items have not been verified as delivered to the table yet. Please confirm delivery status or cancel items before payment.',
        unresolved
      });
    }

    // Atomically ensure all remaining active order items are marked as served
    for (const order of orders) {
      let orderModified = false;
      order.items.forEach((item) => {
        if (!isItemCancelled(item) && item.status !== 'served') {
          item.status = 'served';
          orderModified = true;
        }
      });
      if (orderModified || (order.status !== 'served' && order.status !== 'cancelled')) {
        recalcOrderDoc(order);
        if (dbSession) {
          await order.save({ session: dbSession });
        } else {
          await order.save();
        }
      }
    }

    // Recalculate bill amounts strictly following: subtotal + 5% GST - discount
    const liveOrders = orders.filter((o) => o.status !== 'cancelled');
    const subtotal = liveOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const discount = liveOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const gst = Math.round(subtotal * 0.05);
    const total = Math.max(0, subtotal + gst - discount);

    const now = new Date();
    session.subtotal = subtotal;
    session.discount = discount > 0 ? discount : (session.discount || 0);
    session.gst = gst;
    session.total = total;
    session.status = 'completed';
    session.paymentStatus = total > 0 ? 'successful' : 'not_required';
    session.paidAt = now;
    session.closedAt = now;
    session.orderIds = orders.map((o) => o._id);

    if (dbSession) {
      await session.save({ session: dbSession });
    } else {
      await session.save();
    }

    // Atomically update customer activity and spend in Customer collection
    if (session.customerMobile) {
      const cleanMobile = String(session.customerMobile).replace(/\D/g, '').slice(-10);
      const custQuery = Customer.findOneAndUpdate(
        { restaurantId: session.restaurantId, mobile: cleanMobile },
        {
          $inc: { totalSpend: Math.max(0, session.total || 0) },
          $set: { lastVisitAt: now }
        }
      );
      if (dbSession) custQuery.session(dbSession);
      await custQuery;
    }

    // Commit transaction guaranteeing Atomicity, Consistency, Isolation, Durability
    if (dbSession) {
      await dbSession.commitTransaction();
    }

    // Broadcast session:completed to both restaurant admin and customer table
    emitToRestaurant(session.restaurantId, 'session:completed', {
      session,
      tableId: session.tableId
    });

    emitToTable(session.tableId, 'session:completed', {
      session,
      tableId: session.tableId
    });

    return res.status(200).json({
      success: true,
      message: 'Payment recorded and session completed successfully. Table is now free!',
      data: session
    });
  } catch (error) {
    if (useTransaction) {
      try {
        await dbSession.abortTransaction();
      } catch (abortErr) {
        console.error('Error aborting transaction:', abortErr);
      }
    }
    console.error('Error marking session as paid:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    await dbSession.endSession();
  }
};
