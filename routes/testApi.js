const express = require('express');
const router = express.Router();
const { seedDatabase } = require('../utils/seedDatabase');
const mongoose = require('mongoose');

// @route   POST /api/test/seed  or  GET /api/test/seed
// @desc    Seed comprehensive demo/test data for the entire Tablly platform
// @access  Public (Dev / Test utility)
const handleSeed = async (req, res) => {
  try {
    const reset = req.query.reset === 'false' || req.body?.reset === false ? false : true;
    console.log(`[Test API] Starting database seed (reset=${reset})...`);
    
    const summary = await seedDatabase({ reset });
    
    return res.status(200).json({
      success: true,
      message: 'Demo data seeded successfully for entire project!',
      credentials: {
        superAdmin: {
          email: 'admin@tablly.com',
          password: 'Admin@1234',
          portal: 'Super Admin Dashboard'
        },
        restaurantAdmin: {
          email: 'admin@urbancafe.com',
          password: 'Password@1234',
          restaurant: 'Urban Cafe & Bistro',
          subdomain: 'urbancafe',
          qrMenuUrl: 'http://urbancafe.localhost:3000/menu/Table 01'
        }
      },
      summary
    });
  } catch (error) {
    console.error('[Test API] Error seeding database:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to seed database',
      error: error.message
    });
  }
};

router.post('/seed', handleSeed);
router.get('/seed', handleSeed);

// @route   GET /api/test/status
// @desc    Check database connection and counts of all collections
router.get('/status', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const collections = await mongoose.connection.db.listCollections().toArray();
    const stats = {};
    
    for (const col of collections) {
      stats[col.name] = await mongoose.connection.db.collection(col.name).countDocuments();
    }
    
    return res.status(200).json({
      success: true,
      database: mongoose.connection.name,
      connected: isConnected,
      counts: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
