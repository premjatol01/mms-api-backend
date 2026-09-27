require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const masterMenuRoutes = require('./routes/masterMenu');
const platformSettingsRoutes = require('./routes/platformSettings');
const restaurantRoutes = require('./routes/restaurant');
const leadRoutes = require('./routes/lead');
const qrTemplateRoutes = require('./routes/qrTemplate');

// Connect to MongoDB
connectDB();

const app = express();

// Global Middleware
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];

const path = require('path');

app.use(cors({
  origin: allowedOrigins,
  credentials: true // Important for sending cookies
}));
app.use(express.json());
// Only parse urlencoded bodies for non-multipart requests so multer handles file upload streams directly
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) return next();
  return express.urlencoded({ extended: true })(req, res, next);
});
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/master-menu', masterMenuRoutes);
app.use('/api/platform-settings', platformSettingsRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/qr-templates', qrTemplateRoutes);

// Basic health check route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Tablly API is running...' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
