// routes/businessProfileRoutes.js
const express = require('express');
const router = express.Router();
const businessProfileController = require('../controllers/businessProfileController');
const authenticate = require('../middlewares/authenticate');

router.post('/save', authenticate, businessProfileController.saveBusinessProfile);
router.post('/submit', authenticate, businessProfileController.submitForReview);
router.get('/', authenticate, businessProfileController.getBusinessProfile);

router.post('/step4-survey', authenticate, businessProfileController.saveStep4Survey);


module.exports = router;
