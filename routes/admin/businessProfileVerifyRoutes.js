// routes/admin/businessProfileVerifyRoutes.js
const express = require('express');
const router = express.Router();

const authenticate = require('../../middlewares/authenticate');
const isAdmin = require('../../middlewares/isAdmin');

const {
  getPendingBusinessProfiles,
  getBusinessProfileDetails,
  verifyQuestion,
  finalizeBusinessProfile
} = require('../../controllers/admin/businessProfileVerifyController');

// Get pending business profiles
router.get('/pending', authenticate, isAdmin, getPendingBusinessProfiles);

// Get specific business profile details
router.get('/:profileId', authenticate, isAdmin, getBusinessProfileDetails);

// Verify individual question
router.post('/:profileId/verify/:questionNumber', authenticate, isAdmin, verifyQuestion);

// Final approval
router.post('/:profileId/finalize', authenticate, isAdmin, finalizeBusinessProfile);

module.exports = router;
