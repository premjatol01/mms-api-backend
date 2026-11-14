const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const MasterCategory = require('../models/MasterCategory');
const MasterItem = require('../models/MasterItem');
const MenuCategory = require('../models/MenuCategory');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Session = require('../models/Session');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const CustomerReview = require('../models/CustomerReview');
const Offer = require('../models/Offer');
const Package = require('../models/Package');
const PlatformSettings = require('../models/PlatformSettings');
const Lead = require('../models/Lead');
const QRTemplate = require('../models/QRTemplate');

async function seedDatabase({ reset = true } = {}) {
  const summary = {};

  if (reset) {
    // Clear existing operational data
    await Promise.all([
      User.deleteMany({}),
      Restaurant.deleteMany({}),
      MasterCategory.deleteMany({}),
      MasterItem.deleteMany({}),
      MenuCategory.deleteMany({}),
      MenuItem.deleteMany({}),
      Table.deleteMany({}),
      Session.deleteMany({}),
      Order.deleteMany({}),
      Customer.deleteMany({}),
      CustomerReview.deleteMany({}),
      Offer.deleteMany({}),
      Package.deleteMany({}),
      PlatformSettings.deleteMany({}),
      Lead.deleteMany({}),
      QRTemplate.deleteMany({})
    ]);
  }

  // 1. Platform Settings
  const platformSettings = await PlatformSettings.create({
    platformName: 'Tablly Platform',
    companyName: 'Tablly Technologies Pvt Ltd',
    supportEmail: 'support@tablly.com',
    supportPhone: '+91 98765 43210',
    websiteUrl: 'https://tablly.com',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12 Hour',
    platformStatus: 'Active',
    paymentUpiId: 'tablly@upi',
    paymentAccountName: 'Tablly Technologies',
    paymentInstructions: 'Scan the QR code with any UPI app (GPay/PhonePe/Paytm) to activate subscription.'
  });
  summary.platformSettings = 1;

  // 2. Subscription Packages
  const packages = await Package.insertMany([
    {
      name: 'Starter Plan',
      description: 'Ideal for small cafes & quick-service food trucks',
      maxTables: 10,
      features: ['QR Menu & Digital Ordering', 'Basic Analytics', 'Up to 10 Tables', 'Email Support'],
      price: 499,
      status: 'active',
      pricing: [
        { duration: 'monthly', durationDays: 30, durationDisplay: '1 Month', price: 499, isPopular: false },
        { duration: 'yearly', durationDays: 365, durationDisplay: '1 Year', price: 4999, isPopular: true }
      ]
    },
    {
      name: 'Pro Growth Plan',
      description: 'Full-featured solution for growing restaurants & bistros',
      maxTables: 35,
      features: ['Live Order Management', 'QR Menu & Table Ordering', 'Customer CRM & Reviews', 'Custom Subdomain & Website', 'Priority Support'],
      price: 1499,
      status: 'active',
      pricing: [
        { duration: 'monthly', durationDays: 30, durationDisplay: '1 Month', price: 1499, isPopular: false },
        { duration: 'yearly', durationDays: 365, durationDisplay: '1 Year', price: 14990, isPopular: true }
      ]
    },
    {
      name: 'Enterprise Plan',
      description: 'Multi-chain & fine-dining complete digital management',
      maxTables: 100,
      features: ['Unlimited Tables', 'Multi-staff Access', 'Advanced Analytics & Reports', 'Dedicated Account Manager', 'Custom Branding'],
      price: 3499,
      status: 'active',
      pricing: [
        { duration: 'monthly', durationDays: 30, durationDisplay: '1 Month', price: 3499, isPopular: false },
        { duration: 'yearly', durationDays: 365, durationDisplay: '1 Year', price: 34990, isPopular: true }
      ]
    }
  ]);
  summary.packages = packages.length;

  // 3. Super Admin User
  const defaultPasswordHash = await bcrypt.hash('Password@1234', 10);
  const superAdminPasswordHash = await bcrypt.hash('Admin@1234', 10);

  const superAdmin = await User.create({
    name: 'Super Admin',
    email: 'admin@tablly.com',
    phone: '9876543210',
    password: superAdminPasswordHash,
    role: 'super_admin',
    status: 'active'
  });
  summary.superAdmin = superAdmin.email;

  // 4. Master Menu Catalog (Managed by Super Admin)
  const masterCats = await MasterCategory.insertMany([
    { name: 'Beverages & Mocktails', description: 'Fresh coffees, shakes, and mocktails', status: 'active' },
    { name: 'Pizzas & Pastas', description: 'Italian artisan pizzas and pasta bowls', status: 'active' },
    { name: 'Burgers & Wraps', description: 'Loaded burgers and grilled wraps', status: 'active' },
    { name: 'Desserts & Sweets', description: 'Cakes, waffles, and ice cream sundaes', status: 'active' }
  ]);

  const masterItems = await MasterItem.insertMany([
    { categoryId: masterCats[0]._id, name: 'Cold Brew Coffee', description: 'Slow-steeped artisan arabica coffee over ice', status: 'active' },
    { categoryId: masterCats[0]._id, name: 'Virgin Mojito', description: 'Refreshing lime and mint cooler with soda', status: 'active' },
    { categoryId: masterCats[1]._id, name: 'Margherita Basil Pizza', description: 'San Marzano tomato sauce, fresh mozzarella, and basil', status: 'active' },
    { categoryId: masterCats[1]._id, name: 'Truffle Alfredo Pasta', description: 'Creamy fettuccine infused with mushroom truffle oil', status: 'active' },
    { categoryId: masterCats[2]._id, name: 'Gourmet Veggie Burger', description: 'Crispy veggie patty with chipotle mayo and cheddar', status: 'active' },
    { categoryId: masterCats[3]._id, name: 'Molten Choco Lava Cake', description: 'Warm chocolate cake with a molten center and vanilla scoop', status: 'active' }
  ]);
  summary.masterCategories = masterCats.length;
  summary.masterItems = masterItems.length;

  // 5. Sample Restaurant: Urban Cafe & Bistro
  const urbanCafe = await Restaurant.create({
    name: 'Urban Cafe & Bistro',
    tagline: 'Craft Coffee & Artisanal Eats',
    shortDescription: 'Modern cozy cafe serving wood-fired pizzas, gourmet burgers, and specialty coffees.',
    fullDescription: 'Urban Cafe & Bistro brings the finest artisan dining experience with fresh organic ingredients, cozy ambiance, and contactless table ordering.',
    restaurantType: 'Cafe',
    cuisineTypes: ['Continental', 'Italian', 'Cafe', 'Beverages'],
    establishmentYear: 2022,
    phone: '9876500001',
    email: 'info@urbancafe.com',
    admin: {
      name: 'Aarav Sharma',
      email: 'admin@urbancafe.com',
      phone: '9876500001',
      personalAddress: {
        line1: 'Flat 402, Green Valley Apartments',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400050'
      }
    },
    address: {
      fullAddress: 'Shop 12, High Street Mall, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pincode: '400050'
    },
    subscription: {
      packageId: packages[1]._id,
      packageName: packages[1].name,
      duration: 'yearly',
      durationDisplay: '1 Year',
      price: packages[1].price,
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    },
    website: {
      subdomain: 'urbancafe',
      status: 'published',
      url: 'http://urbancafe.localhost:3000'
    },
    contact: {
      primaryPhone: '9876500001',
      email: 'info@urbancafe.com',
      whatsapp: '9876500001'
    },
    settings: {
      isActive: true,
      acceptOrders: true,
      showOnPublicWebsite: true
    },
    gstSettings: {
      enabled: true,
      percentage: 5,
      gstNumber: '27AAAAA0000A1Z5',
      chargeType: 'exclusive'
    },
    status: 'active'
  });

  // Restaurant Admin User
  const restaurantUser = await User.create({
    name: 'Aarav Sharma',
    email: 'admin@urbancafe.com',
    phone: '9876500001',
    password: defaultPasswordHash,
    role: 'restaurant_admin',
    restaurantId: urbanCafe._id,
    status: 'active'
  });
  summary.restaurantAdmin = {
    email: restaurantUser.email,
    password: 'Password@1234',
    restaurant: urbanCafe.name,
    subdomain: urbanCafe.website.subdomain
  };

  // 6. Menu Categories for Urban Cafe
  const catBeverages = await MenuCategory.create({
    restaurantId: urbanCafe._id,
    name: 'Beverages & Coffee',
    description: 'Freshly brewed coffees, coolers, and teas',
    displayOrder: 1,
    status: 'active',
    isTopCategory: true
  });

  const catPizzas = await MenuCategory.create({
    restaurantId: urbanCafe._id,
    name: 'Wood Fired Pizzas',
    description: 'Hand-tossed 11-inch thin crust pizzas',
    displayOrder: 2,
    status: 'active',
    isTopCategory: true
  });

  const catBurgers = await MenuCategory.create({
    restaurantId: urbanCafe._id,
    name: 'Gourmet Burgers',
    description: 'Brioche bun burgers served with crispy salted fries',
    displayOrder: 3,
    status: 'active'
  });

  const catDesserts = await MenuCategory.create({
    restaurantId: urbanCafe._id,
    name: 'Artisan Desserts',
    description: 'Decadent baked sweets and cold treats',
    displayOrder: 4,
    status: 'active'
  });

  // 7. Menu Items for Urban Cafe
  const items = await MenuItem.insertMany([
    {
      restaurantId: urbanCafe._id,
      categoryId: catBeverages._id,
      name: 'Iced Hazelnut Latte',
      description: 'Double espresso shot with hazelnut syrup and chilled milk',
      price: 199,
      mrp: 249,
      foodType: 'veg',
      status: 'available',
      isPopular: true,
      isBestseller: true,
      prepTime: 5,
      spiciness: 'none',
      image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500'
    },
    {
      restaurantId: urbanCafe._id,
      categoryId: catBeverages._id,
      name: 'Fresh Passion Fruit Cooler',
      description: 'Passion fruit pulp, fresh mint leaves, lemon juice, and crushed ice',
      price: 169,
      mrp: 199,
      foodType: 'veg',
      status: 'available',
      isPopular: false,
      prepTime: 5,
      spiciness: 'none',
      image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500'
    },
    {
      restaurantId: urbanCafe._id,
      categoryId: catPizzas._id,
      name: 'Classic Margherita Pizza',
      description: 'San Marzano tomato sauce, fresh mozzarella cheese, and fresh basil',
      price: 349,
      mrp: 399,
      foodType: 'veg',
      status: 'available',
      isPopular: true,
      isBestseller: true,
      prepTime: 15,
      serves: 2,
      spiciness: 'mild',
      image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500'
    },
    {
      restaurantId: urbanCafe._id,
      categoryId: catPizzas._id,
      name: 'Peri-Peri Paneer Pizza',
      description: 'Spicy peri-peri marinated paneer cubes, bell peppers, and red onions',
      price: 429,
      mrp: 479,
      foodType: 'veg',
      status: 'available',
      isPopular: true,
      prepTime: 18,
      serves: 2,
      spiciness: 'spicy',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500'
    },
    {
      restaurantId: urbanCafe._id,
      categoryId: catBurgers._id,
      name: 'Crispy Truffle Veggie Burger',
      description: 'Crispy spiced vegetable patty, truffle mayo, cheddar slice, and lettuce',
      price: 279,
      mrp: 319,
      foodType: 'veg',
      status: 'available',
      isPopular: false,
      prepTime: 12,
      serves: 1,
      spiciness: 'medium',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'
    },
    {
      restaurantId: urbanCafe._id,
      categoryId: catDesserts._id,
      name: 'Sizzling Brownie with Vanilla Scoop',
      description: 'Fudgy dark chocolate brownie on a sizzler plate topped with hot fudge and vanilla gelato',
      price: 229,
      mrp: 269,
      foodType: 'veg',
      status: 'available',
      isPopular: true,
      isBestseller: true,
      prepTime: 8,
      serves: 1,
      spiciness: 'none',
      image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500'
    }
  ]);
  summary.menuCategories = 4;
  summary.menuItems = items.length;

  // 8. Tables for Urban Cafe
  const tables = await Table.insertMany([
    { restaurantId: urbanCafe._id, tableId: 'T1', tableNo: 'Table 01', number: 1, status: 'active' },
    { restaurantId: urbanCafe._id, tableId: 'T2', tableNo: 'Table 02', number: 2, status: 'active' },
    { restaurantId: urbanCafe._id, tableId: 'T3', tableNo: 'Table 03', number: 3, status: 'active' },
    { restaurantId: urbanCafe._id, tableId: 'T4', tableNo: 'Table 04', number: 4, status: 'active' },
    { restaurantId: urbanCafe._id, tableId: 'T5', tableNo: 'Table 05', number: 5, status: 'active' },
    { restaurantId: urbanCafe._id, tableId: 'VIP1', tableNo: 'VIP Lounge 01', number: 6, status: 'active' }
  ]);
  summary.tables = tables.length;

  // 9. Customers
  const customer1 = await Customer.create({
    restaurantId: urbanCafe._id,
    name: 'Rohan Mehta',
    mobile: '9811122233',
    email: 'rohan.mehta@example.com',
    totalVisits: 3,
    totalSpend: 2450
  });

  const customer2 = await Customer.create({
    restaurantId: urbanCafe._id,
    name: 'Pooja Iyer',
    mobile: '9822233344',
    email: 'pooja.iyer@example.com',
    totalVisits: 1,
    totalSpend: 827
  });
  summary.customers = 2;

  // 10. Sessions & Live Orders
  // Session 1: Active on Table 01
  const session1 = await Session.create({
    restaurantId: urbanCafe._id,
    tableId: tables[0]._id,
    sessionNumber: 'SES-1001',
    status: 'active',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    customerId: customer1._id,
    customerName: customer1.name,
    customerMobile: customer1.mobile,
    subtotal: 548,
    gst: 27.4,
    total: 575.4
  });

  const order1 = await Order.create({
    restaurantId: urbanCafe._id,
    sessionId: session1._id,
    tableId: tables[0]._id,
    orderNumber: 'ORD-101',
    source: 'qr',
    status: 'processing',
    customer: {
      customerId: customer1._id,
      name: customer1.name,
      mobile: customer1.mobile
    },
    items: [
      {
        menuItemId: items[0]._id,
        name: items[0].name,
        price: items[0].price,
        quantity: 1,
        imageUrl: items[0].image,
        status: 'served'
      },
      {
        menuItemId: items[2]._id,
        name: items[2].name,
        price: items[2].price,
        quantity: 1,
        imageUrl: items[2].image,
        status: 'processing'
      }
    ],
    subtotal: 548,
    discount: 0,
    total: 575.4
  });

  session1.orderIds = [order1._id];
  await session1.save();

  // Session 2: Completed on Table 02
  const session2 = await Session.create({
    restaurantId: urbanCafe._id,
    tableId: tables[1]._id,
    sessionNumber: 'SES-1000',
    status: 'completed',
    paymentStatus: 'successful',
    paymentMethod: 'upi',
    customerId: customer2._id,
    customerName: customer2.name,
    customerMobile: customer2.mobile,
    subtotal: 788,
    gst: 39.4,
    total: 827.4,
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    closedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
  });

  const order2 = await Order.create({
    restaurantId: urbanCafe._id,
    sessionId: session2._id,
    tableId: tables[1]._id,
    orderNumber: 'ORD-100',
    source: 'qr',
    status: 'served',
    customer: {
      customerId: customer2._id,
      name: customer2.name,
      mobile: customer2.mobile
    },
    items: [
      {
        menuItemId: items[3]._id,
        name: items[3].name,
        price: items[3].price,
        quantity: 1,
        imageUrl: items[3].image,
        status: 'served'
      },
      {
        menuItemId: items[4]._id,
        name: items[4].name,
        price: items[4].price,
        quantity: 1,
        imageUrl: items[4].image,
        status: 'served'
      }
    ],
    subtotal: 788,
    discount: 0,
    total: 827.4
  });

  session2.orderIds = [order2._id];
  await session2.save();

  summary.sessions = 2;
  summary.orders = 2;

  // 11. Customer Reviews
  const reviews = await CustomerReview.insertMany([
    {
      restaurantId: urbanCafe._id,
      tableId: tables[0]._id,
      tableName: 'Table 01',
      customerName: 'Rohan Mehta',
      customerMobile: '9811122233',
      rating: 5,
      comment: 'Super fast QR ordering and the Cold Coffee & Truffle Burger were outstanding!',
      status: 'accepted',
      selectedForPortfolio: true
    },
    {
      restaurantId: urbanCafe._id,
      tableId: tables[1]._id,
      tableName: 'Table 02',
      customerName: 'Pooja Iyer',
      customerMobile: '9822233344',
      rating: 5,
      comment: 'Loved the ambiance and thin-crust Margherita pizza. Highly recommended!',
      status: 'accepted',
      selectedForPortfolio: true
    }
  ]);
  summary.customerReviews = reviews.length;

  // 12. Offers
  const offers = await Offer.insertMany([
    {
      restaurantId: urbanCafe._id,
      name: 'WELCOME20 - 20% Off',
      type: 'order_value',
      benefit: { type: 'percentage', value: 20 },
      minimumOrderAmount: 399,
      status: 'active',
      terms: 'Valid on food orders above ₹399. Cannot be combined with other offers.',
      performance: { timesAvailed: 14, totalDiscountGiven: 1120 }
    },
    {
      restaurantId: urbanCafe._id,
      name: 'FLAT50 Weekend Treat',
      type: 'order_value',
      benefit: { type: 'flat', value: 50 },
      minimumOrderAmount: 299,
      status: 'active',
      terms: 'Flat ₹50 off on weekend orders.',
      performance: { timesAvailed: 8, totalDiscountGiven: 400 }
    }
  ]);
  summary.offers = offers.length;

  // 13. CRM Leads (for Super Admin dashboard)
  const leads = await Lead.insertMany([
    {
      restaurantName: 'Bella Italia Bistro',
      address: { fullAddress: 'Connaught Place, Central Delhi', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
      contactPerson: 'Vikram Sethi',
      phone: '9810012345',
      email: 'vikram@bellaitalia.in',
      restaurantType: 'Fine Dining',
      stage: 'qualified',
      status: 'active',
      notes: 'Interested in digital QR ordering and multi-table billing.'
    },
    {
      restaurantName: 'The Chai Club',
      address: { fullAddress: 'Indiranagar 100ft Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
      contactPerson: 'Ananya Rao',
      phone: '9845098765',
      email: 'ananya@thechaiclub.com',
      restaurantType: 'Cafe',
      stage: 'prospect',
      status: 'active',
      notes: 'Requested live demo for cafe chain with 3 outlets.'
    }
  ]);
  summary.leads = leads.length;

  return summary;
}

module.exports = { seedDatabase };
