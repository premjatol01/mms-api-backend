require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const masterMenuRoutes = require('./routes/masterMenu');

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
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/master-menu', masterMenuRoutes);

// Basic health check route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Tablly API is running...' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
