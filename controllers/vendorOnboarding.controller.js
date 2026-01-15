const VendorOnboarding = require("../models/VendorOnboardingStage1");
const User = require("../models/User");
const { sendAdminOnboardingSubmissionEmail, sendVendorSubmissionConfirmationEmail } = require("../utils/WellcomeMailer");

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/* =====================================================
   COMMON VALIDATION HELPERS
===================================================== */

const isValidUrl = (url) => {
  const pattern =
    /^(https?:\/\/)?([\w\-])+\.{1}([a-zA-Z]{2,63})([\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/;
  return pattern.test(url);
};

const validateStage1Payload = (body) => {
  const errors = [];

  // 1. Business Name
  if (!body.businessName || body.businessName.trim().length < 2) {
    errors.push("Business name is required");
  }

  // 2. Minority owned validation
  // if (body.isMinorityOwned === false) {
  //   errors.push("Only minority-owned businesses are allowed");
  // }

  // if (
  //   body.isMinorityOwned === true &&
  //   (!Array.isArray(body.minorityCategories) ||
  //     body.minorityCategories.length === 0)
  // ) {
  //   errors.push("At least one minority category must be selected");
  // }

  // // 3. EIN / SSN validation
  // if (body.hasEIN === true) {
  //   if (!/^[0-9]{9}$/.test(body.einNumber || "")) {
  //     errors.push("Valid 9-digit EIN is required");
  //   }
  // } else {
  //   if (!/^[0-9]{9}$/.test(body.ssnLast9 || "")) {
  //     errors.push("Valid 9-digit SSN is required");
  //   }
  // }

  // // 4. Business License
  // if (body.hasBusinessLicense === false) {
  //   errors.push("Business license is mandatory to proceed");
  // }

  // // 5. Franchise validation
  // if (body.isFranchise === true && !body.franchiseName) {
  //   errors.push("Franchise name is required");
  // }

  // // 6. Business type
  // if (!["product", "service", "food"].includes(body.businessType)) {
  //   errors.push("Invalid business type");
  // }

  // // 7. URLs (optional but validated)
  // ["website", "facebook", "instagram", "linkedin", "tiktok"].forEach((field) => {
  //   if (body[field] && !isValidUrl(body[field])) {
  //     errors.push(`Invalid URL provided for ${field}`);
  //   }
  // });

  // // 8. Contact person
  // if (!body.primaryContactName) {
  //   errors.push("Primary contact name is required");
  // }

  // if (!body.primaryContactDesignation) {
  //   errors.push("Primary contact designation is required");
  // }

  // // 9. Address
  // if (!body.address?.street || !body.address?.city || !body.address?.country) {
  //   errors.push("Complete address is required");
  // }

  // // 10. Employees
  // if (
  //   body.employeesCount &&
  //   !["0-1", "2-5", "6-10", "10+"].includes(body.employeesCount)
  // ) {
  //   errors.push("Invalid employees count");
  // }

  // // 11. Agreements
  // if (!body.acceptedTerms || !body.declarationAccepted) {
  //   errors.push("Terms & declaration must be accepted");
  // }

  return errors;
};

/* =====================================================
   SAVE OR UPDATE DRAFT

   ===================================================== */

   exports.saveDraft = async (req, res) => {
  try {
    const userId = req.user._id;
    const payload = req.body;

    // 1️⃣ Check existing onboarding
    let onboarding = await VendorOnboarding.findOne({ userId });

    // 2️⃣ Lock if already submitted
    if (onboarding && onboarding.status === "submitted") {
      return res.status(400).json({
        success: false,
        message: "Onboarding already submitted and cannot be edited",
      });
    }

    // 3️⃣ Generate applicationId ONLY once
    if (!onboarding) {
      onboarding = new VendorOnboarding({
        userId,
        applicationId: `MBH-APP-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`,
        status: "draft",
      });
    }

    // 4️⃣ Map frontend fields to database fields
    const mappedPayload = {
      ...payload,
      // Map URL fields
      website: payload.websiteUrl,
      facebook: payload.facebookUrl,
      instagram: payload.instagramUrl,
      linkedin: payload.linkedinUrl,
      tiktok: payload.tiktokUrl,
      
      // Map other fields
      ownershipType: payload.businessOwnershipType,
      employeesCount: payload.numberOfEmployees,
      secondaryBusinessEmail: payload.businessEmail,
      usesThirdPartyBooking: payload.hasThirdPartyBooking,
      
      // Remove frontend-only fields
      websiteUrl: undefined,
      facebookUrl: undefined,
      instagramUrl: undefined,
      linkedinUrl: undefined,
      tiktokUrl: undefined,
      businessOwnershipType: undefined,
      numberOfEmployees: undefined,
      businessEmail: undefined,
      hasThirdPartyBooking: undefined,
      contactEmail: undefined,
      contactPhone: undefined
    };

    // Apply mapped fields
    Object.assign(onboarding, mappedPayload);
    onboarding.status = "draft"; 

    // 5️⃣ Save document
    await onboarding.save();

    return res.status(200).json({
      success: true,
      message: "Stage-1 draft saved successfully",
      data: onboarding,
    });
  } catch (error) {
    console.error("Save draft error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save onboarding draft",
    });
  }
};


// exports.saveDraft = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const payload = req.body;

//     // 1️⃣ Check existing onboarding
//     let onboarding = await VendorOnboarding.findOne({ userId });

//     // 2️⃣ Lock if already submitted
//     if (onboarding && onboarding.status === "submitted") {
//       return res.status(400).json({
//         success: false,
//         message: "Onboarding already submitted and cannot be edited",
//       });
//     }

//     // 3️⃣ Generate applicationId ONLY once
//     if (!onboarding) {
//       onboarding = new VendorOnboarding({
//         userId,
//         applicationId: `MBH-APP-${Date.now()}-${Math.random()
//           .toString(36)
//           .substring(2, 8)
//           .toUpperCase()}`,
//         status: "draft",
//       });
//     }

//     // 4️⃣ Apply incoming draft fields safely
//     Object.assign(onboarding, payload);

//     onboarding.status = "draft"; 

//     // 5️⃣ Save document (pre-save hooks fire)
//     await onboarding.save();

//     return res.status(200).json({
//       success: true,
//       message: "Stage-1 draft saved successfully",
//       data: onboarding,
//     });
//   } catch (error) {
//     console.error("Save draft error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to save onboarding draft",
//     });
//   }
// };


/* =====================================================
   FETCH DRAFT
===================================================== */

exports.getDraft = async (req, res) => {
  try {
    const onboarding = await VendorOnboarding.findOne({
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      data: onboarding,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch draft",
    });
  }
};

//payment controllers
// exports.createVerificationPayment = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     // Find onboarding record
//     const onboarding = await VendorOnboarding.findOne({ userId });
    
//     if (!onboarding) {
//       return res.status(404).json({
//         success: false,
//         message: "Please save your onboarding draft first"
//       });
//     }

//     // Check if already paid
//     if (onboarding.verificationPayment?.status === "paid") {
//       return res.status(400).json({
//         success: false,
//         message: "Verification fee already paid"
//       });
//     }



//     // Create Stripe Payment Intent
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: 2499, // $24.99 in cents
//       currency: 'usd',
//       metadata: {
//         userId: userId.toString(),
//         type: 'vendor_verification',
//         applicationId: onboarding.applicationId || 'N/A'
//       },
//       description: 'Vendor Onboarding Verification Fee'
//     });

//     // Update onboarding record
//     onboarding.verificationPayment = {
//       provider: 'stripe',
//       paymentIntentId: paymentIntent.id,
//       amount: 2400,
//       currency: 'usd',
//       status: 'pending'
//     };
//     onboarding.status = 'payment_pending';

//     await onboarding.save();

//     return res.status(200).json({
//       success: true,
//       message: "Payment intent created successfully",
//       data: {
//         clientSecret: paymentIntent.client_secret,
//         amount: 2400,
//         currency: 'usd'
//       }
//     });

//   } catch (error) {
//     console.error("Payment creation error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create payment"
//     });
//   }
// };


exports.createVerificationPayment = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find onboarding record
    const onboarding = await VendorOnboarding.findOne({ userId });
    
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Please save your onboarding draft first"
      });
    }

    // Check if already paid
    if (onboarding.verificationPayment?.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Verification fee already paid"
      });
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2499, // $24.99 in cents
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        type: 'vendor_verification',
        applicationId: onboarding.applicationId || 'N/A'
      },
      description: 'Vendor Onboarding Verification Fee'
    });

    // Update onboarding record with payment intent
    onboarding.verificationPayment = {
      provider: 'stripe',
      paymentIntentId: paymentIntent.id,
      amount: 2400,
      currency: 'usd',
      status: 'paid', // Auto-mark as paid for testing
      paidAt: new Date() // Set paid timestamp
    };
    onboarding.status = 'draft'; // Set to draft so user can submit

    await onboarding.save();

    return res.status(200).json({
      success: true,
      message: "Payment intent created and auto-paid for testing",
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: 2400,
        currency: 'usd',
        status: 'paid' // Return paid status
      }
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment"
    });
  }
};



/* =====================================================
   STRIPE WEBHOOK HANDLER FOR VENDOR VERIFICATION PAYMENTS
===================================================== */

exports.handleVendorPaymentWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const payload = req.body;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Skip signature verification for testing when no signature provided
    if (!sig) {
      console.log('No signature provided - using payload directly for testing');
      event = JSON.parse(payload.toString());
    } else {
      // Verify webhook signature in production
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    }
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      if (paymentIntent.metadata.type === 'vendor_verification') {
        try {
          const userId = paymentIntent.metadata.userId;
          
          const onboarding = await VendorOnboarding.findOne({ 
            userId,
            'verificationPayment.paymentIntentId': paymentIntent.id 
          });

          if (onboarding) {
            onboarding.verificationPayment.status = 'paid';
            onboarding.verificationPayment.paidAt = new Date();
            onboarding.status = 'draft';
            
            await onboarding.save();
            
            console.log(`✅ Vendor verification payment succeeded for user ${userId}`);
          } else {
            console.log(`❌ No onboarding record found for payment ${paymentIntent.id}`);
          }
        } catch (error) {
          console.error('Failed to update vendor verification payment:', error);
          return res.status(500).send('Database update failed');
        }
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      
      if (failedPaymentIntent.metadata.type === 'vendor_verification') {
        try {
          const userId = failedPaymentIntent.metadata.userId;
          
          const onboarding = await VendorOnboarding.findOne({ 
            userId,
            'verificationPayment.paymentIntentId': failedPaymentIntent.id 
          });

          if (onboarding) {
            onboarding.verificationPayment.status = 'failed';
            onboarding.status = 'draft';
            
            await onboarding.save();
            
            console.log(`❌ Vendor verification payment failed for user ${userId}`);
          }
        } catch (error) {
          console.error('Failed to update vendor verification payment failure:', error);
          return res.status(500).send('Database update failed');
        }
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send({ received: true });
};

/* =====================================================
   GET PAYMENT STATUS
===================================================== */

exports.getPaymentStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const onboarding = await VendorOnboarding.findOne({ userId });
    
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Onboarding record not found"
      });
    }

    const paymentData = {
      required: true,
      amount: 2400,
      currency: 'usd',
      status: onboarding.verificationPayment?.status || 'not_started',
      paidAt: onboarding.verificationPayment?.paidAt || null,
      canSubmit: onboarding.verificationPayment?.status === 'paid'
    };

    return res.status(200).json({
      success: true,
      data: paymentData
    });

  } catch (error) {
    console.error("Get payment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get payment status"
    });
  }
};


/* =====================================================
   SUBMIT FOR REVIEW (STRICT VALIDATION)
===================================================== */




exports.submitForReview = async (req, res) => {
  try {
    const userId = req.user._id;

    const onboarding = await VendorOnboarding.findOne({ userId });

    /* ------------------------------
       BASIC EXISTENCE CHECK
    ------------------------------ */
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Onboarding record not found",
      });
    }

    /* ------------------------------
       STATUS LOCK CHECK
    ------------------------------ */
    if (
      onboarding.status !== "draft" &&
      onboarding.status !== "payment_pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "Onboarding already submitted or locked",
      });
    }

    /* ------------------------------
       PAYMENT VALIDATION (MANDATORY)
    ------------------------------ */
    // if (
    //   !onboarding.verificationPayment ||
    //   onboarding.verificationPayment.status !== "paid"
    // ) {
    //   return res.status(402).json({
    //     success: false,
    //     message: "Verification payment must be completed before submission",
    //   });
    // }

    /* ------------------------------
       FORM VALIDATION (STRICT)
    ------------------------------ */
    const validationErrors = validateStage1Payload(onboarding.toObject());

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    /* ------------------------------
       FINAL SUBMISSION
    ------------------------------ */
    onboarding.status = "submitted";
    onboarding.submittedAt = new Date();
    await onboarding.save();

    /* ------------------------------
       FETCH USER DETAILS
    ------------------------------ */
    const user = await User.findById(userId).select("name email");

    /* ------------------------------
       EMAIL NOTIFICATIONS (NON-BLOCKING)
    ------------------------------ */
    try {
      // 1️⃣ Notify Admin
      await sendAdminOnboardingSubmissionEmail({
        adminEmail: process.env.ADMIN_EMAIL, // e.g. admin@mosaicbizhub.com
        applicationId: onboarding.applicationId,
        businessName: onboarding.businessName,
        vendorName: user.name,
      });

      // 2️⃣ Notify Vendor
      await sendVendorSubmissionConfirmationEmail({
        to: user.email,
        vendorName: user.name,
        applicationId: onboarding.applicationId,
      });
    } catch (emailError) {
      // Emails should NEVER block submission
      console.error("Stage-1 email notification failed:", emailError);
    }

    return res.status(200).json({
      success: true,
      message: "Stage 1 submitted successfully for admin verification",
      applicationId: onboarding.applicationId,
    });
  } catch (error) {
    console.error("Stage-1 submit error:", error);
    return res.status(500).json({
      success: false,
      message: "Stage 1 submission failed",
    });
  }
};


// Direct update payment status to paid (for testing)
exports.markPaymentAsPaid = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const onboarding = await VendorOnboarding.findOne({ userId });
    
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Update payment status directly
    onboarding.verificationPayment = {
      provider: 'stripe',
      paymentIntentId: 'manual_update',
      amount: 2400,
      currency: 'usd',
      status: 'paid',
      paidAt: new Date()
    };
    onboarding.status = 'draft';

    await onboarding.save();

    return res.json({
      success: true,
      message: 'Payment status updated to paid successfully',
      data: {
        status: onboarding.verificationPayment.status,
        paidAt: onboarding.verificationPayment.paidAt
      }
    });

  } catch (error) {
    console.error('Mark payment as paid error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
};


// Get status by application ID
 // Add this function to vendorOnboarding.controller.js

// Get status by application ID
exports.getStatusByApplicationId = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // Get all related data
    const Subscription = require('../models/Subscription');
    const BusinessProfile = require('../models/BusinessProfile');
    
    const onboarding = await VendorOnboarding.findOne({ applicationId });
    
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const [subscription, businessProfile] = await Promise.all([
      Subscription.findOne({ userId: onboarding.userId, status: 'active' }).populate('subscriptionPlanId'),
      BusinessProfile.findOne({ userId: onboarding.userId })
    ]);

    // Determine current status
    let currentStage = 1;
    let status = 'Stage 1 - Document Verification';
    let nextAction = '';

    if (onboarding.status === 'draft') {
      status = 'Stage 1 - Draft (Not Submitted)';
      nextAction = 'Submit application for review';
    } else if (onboarding.status === 'submitted') {
      status = 'Stage 1 - Under Admin Review';
      nextAction = 'Wait for admin verification (24-48 hours)';
    } else if (onboarding.status === 'verified') {
      currentStage = 2;
      if (!subscription) {
        status = 'Stage 2 - Select Subscription Plan';
        nextAction = 'Congrats Your Apllication verified And You Qalify For Nextstep Choose and pay for subscription tier';
      } else {
        currentStage = 3;
        if (!businessProfile) {
          status = 'Stage 3 - Complete Business Profile';
          nextAction = 'Fill out business profile and questions';
        } else if (businessProfile.status === 'draft') {
          status = 'Stage 3 - Business Profile Draft';
          nextAction = 'Submit business profile for review';
        } else if (businessProfile.status === 'submitted') {
          status = 'Stage 3 - Business Profile Under Review';
          nextAction = 'Wait for business profile verification';
        } else if (businessProfile.status === 'approved') {
          currentStage = 4;
          status = 'Onboarding Complete!';
          nextAction = 'Start using the platform';
        }
      }
    } else if (onboarding.status === 'rejected') {
      status = 'Stage 1 - Rejected';
      nextAction = 'Your Application Is Rejected Due To  Not Qualified Our  Verification Criteria ,  Our Team Will Contact You For Further Assistance Thank You ';
    } else if (onboarding.status === 'payment_pending') {
      status = 'Stage  assistance';
    }

    return res.json({
      success: true,
      data: {
        applicationId,
        businessName: onboarding.businessName,
        currentStage,
        status,
        nextAction,
        details: {
          stage1: {
            status: onboarding.status,
            points: onboarding.totalVerificationPoints || 0,
            submittedAt: onboarding.submittedAt,
            paymentStatus: onboarding.verificationPayment?.status || 'not_started'
          },
          stage2: {
            status: subscription ? 'completed' : 'pending',
            plan: subscription?.subscriptionPlanId?.name,
            amount: subscription?.subscriptionPlanId?.price,
            subscribedAt: subscription?.createdAt
          },
          stage3: {
            status: businessProfile?.status || 'not_started',
            badge: businessProfile?.badge,
            totalPoints: businessProfile?.totalPoints || 0,
            submittedAt: businessProfile?.submittedAt,
            approvedAt: businessProfile?.finalizedAt
          }
        }
      }
    });

  } catch (error) {
    console.error('Get status by application ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get application status'
    });
  }
};


exports.getApplicationId = async (req, res) => {
  try {
    const onboarding = await VendorOnboarding.findOne({ userId: req.user._id }).select('applicationId');
    
    return res.json({
      success: true,
      applicationId: onboarding?.applicationId || null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get application ID"
    });
  }
};

