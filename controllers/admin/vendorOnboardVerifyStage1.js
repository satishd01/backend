const VendorOnboarding = require('../../models/VendorOnboardingStage1');
const User = require('../../models/User');
const { 
  sendVendorApprovedEmail,
  sendVendorRejectionEmail
} = require('../../utils/WellcomeMailer');

/* =====================================================
   GET PENDING APPLICATIONS
===================================================== */


exports.getPendingApplications = async (req, res) => {
  try {
    const applications = await VendorOnboarding.find({})
      .populate('userId', 'name email')
      .sort({ submittedAt: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get all applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch applications'
    });
  }
};


// exports.getPendingApplications = async (req, res) => {
//   try {
//     const applications = await VendorOnboarding.find({ 
//       status: 'submitted' 
//     }).populate('userId', 'name email').sort({ submittedAt: -1 });

//     return res.status(200).json({
//       success: true,
//       data: applications
//     });
//   } catch (error) {
//     console.error('Get pending applications error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to fetch applications'
//     });
//   }
// };

/* =====================================================
   GET SINGLE APPLICATION DETAILS
===================================================== */

exports.getApplicationDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // ✅ FIX: Search by applicationId field instead of _id
    const application = await VendorOnboarding.findOne({ applicationId })
      .populate('userId', 'name email phone');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('Get application details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch application details'
    });
  }
};

/* =====================================================
   VERIFY DOCUMENT/CHANNEL AND ALLOCATE POINTS
===================================================== */

exports.verifyAndAllocatePoints = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { verificationType, documentIndex, isVerified } = req.body;

    const application = await VendorOnboarding.findOne({ applicationId });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    let pointsToAdd = 0;
    let alreadyVerified = false;

    // ✅ Use existing verificationChecklist
    if (verificationType === 'minority-proof' && isVerified) {
      if (application.verificationChecklist.minorityDocs) {
        alreadyVerified = true;
      } else {
        if (documentIndex !== undefined && application.minorityProofDocuments[documentIndex]) {
          application.minorityProofDocuments[documentIndex].verified = true;
        }
        application.verificationChecklist.minorityDocs = true;
        pointsToAdd = 10;
      }
    } else if (verificationType === 'tax-doc' && isVerified) {
      if (application.verificationChecklist.taxDocs) {
        alreadyVerified = true;
      } else {
        if (documentIndex !== undefined && application.taxDocuments[documentIndex]) {
          application.taxDocuments[documentIndex].verified = true;
        }
        application.verificationChecklist.taxDocs = true;
        pointsToAdd = 10;
      }
    } else if (verificationType === 'business-license' && isVerified) {
      if (application.verificationChecklist.businessLicense) {
        alreadyVerified = true;
      } else {
        if (documentIndex !== undefined && application.businessLicenseDocuments[documentIndex]) {
          application.businessLicenseDocuments[documentIndex].verified = true;
        }
        application.verificationChecklist.businessLicense = true;
        pointsToAdd = 10;
      }
    } else if (verificationType === 'website' && isVerified) {
      if (application.verificationChecklist.website) {
        alreadyVerified = true;
      } else {
        application.verificationChecklist.website = true;
        pointsToAdd = 5;
      }
    } else if (verificationType === 'facebook' && isVerified) {
      if (application.verificationChecklist.facebook) {
        alreadyVerified = true;
      } else {
        application.verificationChecklist.facebook = true;
        pointsToAdd = 5;
      }
    } else if (verificationType === 'instagram' && isVerified) {
      if (application.verificationChecklist.instagram) {
        alreadyVerified = true;
      } else {
        application.verificationChecklist.instagram = true;
        pointsToAdd = 5;
      }
    } else if (verificationType === 'linkedin' && isVerified) {
      if (application.verificationChecklist.linkedin) {
        alreadyVerified = true;
      } else {
        application.verificationChecklist.linkedin = true;
        pointsToAdd = 5;
      }
    } else if (verificationType === 'tiktok' && isVerified) {
      if (application.verificationChecklist.tiktok) {
        alreadyVerified = true;
      } else {
        application.verificationChecklist.tiktok = true;
        pointsToAdd = 5;
      }
    }

    // Handle unverification (isVerified = false)
    if (!isVerified) {
      if (verificationType === 'minority-proof') {
        application.verificationChecklist.minorityDocs = false;
        pointsToAdd = -10;
      } else if (verificationType === 'tax-doc') {
        application.verificationChecklist.taxDocs = false;
        pointsToAdd = -10;
      } else if (verificationType === 'business-license') {
        application.verificationChecklist.businessLicense = false;
        pointsToAdd = -10;
      } else if (['website', 'facebook', 'instagram', 'linkedin', 'tiktok'].includes(verificationType)) {
        application.verificationChecklist[verificationType] = false;
        pointsToAdd = -5;
      }
    }

    // Return error if already verified
    if (alreadyVerified) {
      return res.status(400).json({
        success: false,
        message: `${verificationType} is already verified`,
        data: {
          totalPoints: application.totalVerificationPoints,
          pointsAdded: 0,
          verificationChecklist: application.verificationChecklist
        }
      });
    }

    // Update points
    application.totalVerificationPoints += pointsToAdd;

    await application.save();

    return res.status(200).json({
      success: true,
      message: `Verification updated. Points: ${application.totalVerificationPoints}`,
      data: {
        totalPoints: application.totalVerificationPoints,
        pointsAdded: pointsToAdd,
        verificationChecklist: application.verificationChecklist
      }
    });

  } catch (error) {
    console.error('Verify and allocate points error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update verification'
    });
  }
};


/* =====================================================
   FINALIZE VERIFICATION (APPROVE/REJECT)
===================================================== */

exports.finalizeVerification = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // ✅ FIX: Search by applicationId field instead of _id
    const application = await VendorOnboarding.findOne({ applicationId })
      .populate('userId', 'name email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const totalPoints = application.totalVerificationPoints;
    
    if (totalPoints >= 30) {
      // SCENARIO 1: Approved (30+ points)
      application.status = 'verified';
      await application.save();
      
      // Send approval email
      await sendVendorApprovedEmail({
        to: application.userId.email,
        vendorName: application.userId.name,
        applicationId: application.applicationId
      });
      
      return res.status(200).json({
        success: true,
        message: 'Application approved successfully',
        data: { status: 'approved', points: totalPoints }
      });
      
    } else {
      // SCENARIO 2: Rejected (<30 points)
      application.status = 'rejected';
      await application.save();
      
      // Send rejection email
      await sendVendorRejectionEmail({
        to: application.userId.email,
        vendorName: application.userId.name,
        applicationId: application.applicationId,
        points: totalPoints
      });
      
      return res.status(200).json({
        success: true,
        message: 'Application rejected due to insufficient points',
        data: { status: 'rejected', points: totalPoints }
      });
    }

  } catch (error) {
    console.error('Finalize verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to finalize verification'
    });
  }
};
