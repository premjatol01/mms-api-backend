require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const masterMenuRoutes = require('./routes/masterMenu');
const platformSettingsRoutes = require('./routes/platformSettings');
const restaurantRoutes = require('./routes/restaurant');
const restaurantProfileRoutes = require('./routes/restaurantProfile');
const leadRoutes = require('./routes/lead');
const qrTemplateRoutes = require('./routes/qrTemplate');

// Connect to MongoDB
connectDB();

const app = express();

// Global Middleware & Dynamic CORS Handling
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  if (origin.includes('.vercel.app')) return true;
  if (origin.includes('.onrender.com')) return true;
  if (process.env.BASE_DOMAIN) {
    const baseHost = process.env.BASE_DOMAIN.split(':')[0].trim();
    if (baseHost && origin.includes(baseHost)) return true;
  }
  return true; // Permit preview & deployment origins with credentials
}

const path = require('path');

app.use(cors({
  origin: function (origin, callback) {
    callback(null, isOriginAllowed(origin));
  },
  credentials: true // Important for sending cookies
}));
app.use(express.json({ limit: '50mb' }));
// Only parse urlencoded bodies for non-multipart requests so multer handles file upload streams directly
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) return next();
  return express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/master-menu', masterMenuRoutes);
app.use('/api/platform-settings', platformSettingsRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/super-admin/profile', require('./routes/superAdminProfile'));
app.use('/api/super-admin/analytics', require('./routes/superAdminAnalytics'));
app.use('/api/restaurant/account', require('./routes/account'));
app.use('/api/restaurant/website', require('./routes/website'));
app.use('/api/restaurant/tables', require('./routes/restaurantTables'));
app.use('/api/restaurant/subscription', require('./routes/restaurantSubscription'));
app.use('/api/restaurant/analytics', require('./routes/restaurantAnalytics'));
app.use('/api/restaurant', restaurantProfileRoutes);
app.use('/api/menu', require('./routes/menu'));
app.use('/api/leads', leadRoutes);
app.use('/api/qr-templates', qrTemplateRoutes);
app.use('/api/offers', require('./routes/offers'));
app.use('/api/public/offers', require('./routes/publicOffers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/cms', require('./routes/cms'));
app.use('/api/biz-growth', require('./routes/bizGrowth'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/otp', require('./routes/otp'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/test', require('./routes/testApi'));

// Basic health check route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Tablly API is running...' });
});

// Create HTTP server and initialize Socket.io
const http = require('http');
const { initSocket } = require('./socket');
const server = http.createServer(app);
initSocket(server);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
