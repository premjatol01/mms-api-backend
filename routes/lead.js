const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead');

// Basic CRUD
router.get('/', leadController.getLeads);
router.post('/', leadController.createLead);
router.get('/:id', leadController.getLead);
router.put('/:id', leadController.updateLead);

// Specific Actions
router.patch('/:id/stage', leadController.changeStage);
router.patch('/:id/status', leadController.toggleStatus);
router.patch('/:id/convert', leadController.convertLead);

module.exports = router;
