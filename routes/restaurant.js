const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  bulkUpdateStatus,
  toggleStatus,
  sendInvite
} = require('../controllers/restaurant');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/restaurants');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.route('/bulk/status')
  .patch(bulkUpdateStatus);

router.route('/')
  .get(getRestaurants)
  .post(upload.single('logo'), createRestaurant);

router.route('/:id')
  .get(getRestaurant)
  .put(upload.single('logo'), updateRestaurant);

router.route('/:id/status')
  .patch(toggleStatus);

router.route('/:id/send-invite')
  .post(sendInvite);

module.exports = router;
