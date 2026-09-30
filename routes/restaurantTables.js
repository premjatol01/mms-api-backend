const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getTables,
  createTables
} = require('../controllers/restaurantTables');

router.use(protect, roleGuard('restaurant_admin'));

router.route('/')
  .get(getTables)
  .post(createTables);

module.exports = router;
