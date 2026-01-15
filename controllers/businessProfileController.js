// controllers/businessProfileController.js
const BusinessProfile = require('../models/BusinessProfile');
const Subscription = require('../models/Subscription');





// Save/Update Business Profile Draft

const saveBusinessProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      logo, businessBio, contactInfo, refundPolicy, 
      termsAndConditions, googleReviewsLink, communityServiceLink,
      step3Questions
    } = req.body;

    // Get user's active subscription to determine tier
    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    }).populate('subscriptionPlanId');

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'Active subscription required'
      });
    }

    const tierName = subscription.subscriptionPlanId.name.toLowerCase();
    const tierType = tierName.includes('basic') ? 'basic' : 
                     tierName.includes('pro') ? 'pro' : 'premium';

    // Define character limits based on tier
    const bioLimits = {
      'basic': 300,    // Silver tier
      'pro': 600,      // Gold tier  
      'premium': 1000  // Platinum tier
    };

    // Validate business bio length based on tier
    if (businessBio && businessBio.length > bioLimits[tierType]) {
      return res.status(400).json({
        success: false,
        message: `Business bio exceeds ${bioLimits[tierType]} character limit for ${tierType} tier`,
        maxLength: bioLimits[tierType],
        currentLength: businessBio.length
      });
    }

    let profile = await BusinessProfile.findOne({ userId });

    if (!profile) {
      profile = new BusinessProfile({
        userId,
        subscriptionId: subscription._id,
        tierType
      });
    }

    // Update fields
    if (logo) profile.logo = logo;
    if (businessBio) profile.businessBio = businessBio;
    if (contactInfo) profile.contactInfo = contactInfo;
    if (refundPolicy) profile.refundPolicy = refundPolicy;
    if (termsAndConditions) profile.termsAndConditions = termsAndConditions;
    if (googleReviewsLink) profile.googleReviewsLink = googleReviewsLink;
    if (communityServiceLink) profile.communityServiceLink = communityServiceLink;

    // Handle step3Questions with point allocation
    if (step3Questions) {
      const pointsMap = { 1: 5, 2: 5, 3: 5, 4: 10, 5: 10, 6: 5, 7: 5 };
      
      profile.step3Questions = step3Questions.map(q => ({
        questionNumber: q.questionNumber,
        answer: q.answer,
        points: pointsMap[q.questionNumber] || 0,
        isVerified: false
      }));
    }

    await profile.save();

    return res.json({
      success: true,
      message: 'Business profile saved successfully',
      data: profile,
      tierInfo: {
        tierType,
        bioLimit: bioLimits[tierType],
        bioUsed: businessBio ? businessBio.length : 0
      }
    });

  } catch (error) {
    console.error('Save business profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save business profile'
    });
  }
};


// Submit for Review
// Update submitForReview function:
// Submit for Review
const submitForReview = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const profile = await BusinessProfile.findOne({ userId })
      .populate('userId', 'name email');
      
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }

    // Validation
    if (!profile.contactInfo?.email || !profile.contactInfo?.phone) {
      return res.status(400).json({
        success: false,
        message: 'Contact information is required'
      });
    }

    if (profile.step3Questions.length < 7) {
      return res.status(400).json({
        success: false,
        message: 'All 7 questions must be answered'
      });
    }

    profile.status = 'submitted';
    profile.submittedAt = new Date();
    await profile.save();

    // Send email to admin for Step 3 review
    try {
      const { sendBusinessProfileReviewEmail } = require('../utils/BuisnessprofileMail');
      await sendBusinessProfileReviewEmail(profile.userId.email, profile.userId.name, profile._id);
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
    }

    return res.json({
      success: true,
      message: 'Business profile submitted for admin review. You will be notified once reviewed.'
    });

  } catch (error) {
    console.error('Submit profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit profile'
    });
  }
};



// Get Business Profile
const getBusinessProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const profile = await BusinessProfile.findOne({ userId })
      .populate('subscriptionId')
      .populate('userId', 'name email');

    return res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Get business profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get business profile'
    });
  }
};


// Add to businessProfileController.js:

// Save Step 4 Survey

// Save Step 4 Survey
const saveStep4Survey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { growthChallenges, growthChallengesOther, platformGoals, platformGoalsOther, targetCustomers } = req.body;

    // Validation
    if (growthChallenges && growthChallenges.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 growth challenges can be selected'
      });
    }

    if (platformGoals && platformGoals.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 platform goals can be selected'
      });
    }

    const profile = await BusinessProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }

    profile.step4Survey = {
      growthChallenges,
      growthChallengesOther,
      platformGoals, 
      platformGoalsOther,
      targetCustomers,
      step4CompletedAt: new Date()
    };

    await profile.save();

    return res.json({
      success: true,
      message: 'Step 4 survey saved successfully',
      data: profile.step4Survey
    });

  } catch (error) {
    console.error('Save Step 4 survey error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save survey'
    });
  }
};


module.exports = {
  saveBusinessProfile,
  submitForReview,
  getBusinessProfile,
  saveStep4Survey
};
