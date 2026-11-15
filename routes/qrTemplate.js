const express = require('express');
const router = express.Router();
const qrTemplateController = require('../controllers/qrTemplate');
const { createUploader } = require('../middleware/upload');

const upload = createUploader('qrcodes');

router.get('/', qrTemplateController.getTemplates);
router.get('/:id', qrTemplateController.getTemplate);
router.post('/', upload.single('templateImage'), qrTemplateController.uploadTemplate);
router.put('/:id', qrTemplateController.updateTemplate);
router.delete('/:id', qrTemplateController.deleteTemplate);

module.exports = router;
