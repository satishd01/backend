const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,     // your email
    pass: process.env.MAIL_PASSWORD, // app password
  },
});

exports.sendWelcomeEmail = async (to, vendorName) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Welcome to Mosaic Biz Hub!',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; background-color: #f9f9f9; padding: 20px;">
        <img src="cid:platformLogo" alt="Mosaic Biz Hub Logo" style="max-width: 150px; margin-bottom: 20px;">
        <h2 style="color: #333;">Welcome to Mosaic Biz Hub, ${vendorName}!</h2>
        <p style="color: #555; font-size: 16px;">
          We’re excited to have you join our platform. Mosaic Biz Hub is here to help you grow your business and connect with new opportunities.
        </p>
        <p style="color: #555; font-size: 16px;">
          Explore, engage, and make the most out of your journey with us.
        </p>
        <a href="https://app.mosaicbizhub.com" 
           style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #0d6efd; color: #fff; text-decoration: none; border-radius: 5px;">
           Visit Platform
        </a>
        <p style="margin-top: 30px; font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Mosaic Biz Hub. All rights reserved.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: 'logo.png',
        path: 'https://app.mosaicbizhub.com/_next/image?url=%2Flogo.png&w=750&q=75',
        cid: 'platformLogo', // same CID as used in the <img src="cid:...">
      }
    ]
  };

  await transporter.sendMail(mailOptions);
};



exports.sendAdminOnboardingSubmissionEmail = async ({
  adminEmail,
  applicationId,
  businessName,
  vendorName,
}) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to: adminEmail,
    subject: "New Vendor Verification Pending",
    html: `
      <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
        <h2 style="color:#333;">New Vendor Application Submitted</h2>

        <p><strong>Application ID:</strong> ${applicationId}</p>
        <p><strong>Business Name:</strong> ${businessName}</p>
        <p><strong>Vendor Name:</strong> ${vendorName}</p>

        <p>
          A new vendor has submitted their Stage-1 onboarding details and is
          awaiting verification.
        </p>

        <a href="https://admin.mosaicbizhub.com/vendor-onboarding/${applicationId}"
           style="display:inline-block;margin-top:16px;padding:10px 16px;
           background:#0d6efd;color:#fff;text-decoration:none;border-radius:4px;">
           Review Application
        </a>

        <p style="margin-top:30px;font-size:12px;color:#777;">
          Mosaic Biz Hub – Admin Notification
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};


exports.sendVendorSubmissionConfirmationEmail = async ({
  to,
  vendorName,
  applicationId,
}) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to,
    subject: "Your Business Verification Is Under Review",
    html: `
      <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
        <h2 style="color:#333;">Hi ${vendorName},</h2>

        <p>
          Thank you for submitting your business details to Mosaic Biz Hub.
          Your application is currently under review.
        </p>

        <p><strong>Application ID:</strong> ${applicationId}</p>

        <p>
          Our team typically completes verification within <strong>48 hours</strong>.
          You’ll receive an email once the review is complete.
        </p>

        <p style="margin-top:20px;">
          If you have questions, contact us at
          <a href="mailto:info@mosaicbizhub.com">info@mosaicbizhub.com</a>
        </p>

        <p style="margin-top:30px;font-size:12px;color:#777;">
          Mosaic Biz Hub Team
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};


exports.sendVendorApprovedEmail = async ({
  to,
  vendorName,
  applicationId,
}) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to,
    subject: "Your Business Has Been Successfully Verified 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
        <h2 style="color:#28a745;">Congratulations, ${vendorName}!</h2>

        <p>
          Your business has successfully passed our initial verification process.
          You’re now eligible to choose your subscription tier and complete
          your profile.
        </p>

        <p><strong>Application ID:</strong> ${applicationId}</p>

        <a href="https://app.mosaicbizhub.com/login?type=vendor"
           style="display:inline-block;margin-top:16px;padding:12px 20px;
           background:#28a745;color:#fff;text-decoration:none;border-radius:4px;">
            Continue Onboarding
        </a>

        <p style="margin-top:30px;font-size:12px;color:#777;">
          Welcome to the Mosaic Biz Hub community!
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};


exports.sendVendorRejectionEmail = async ({
  to,
  vendorName,
  applicationId,
  points
}) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to,
    subject: "Vendor Application Update Required",
    html: `
      <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
        <h2 style="color:#333;">Hello ${vendorName},</h2>
        
        <p>Thank you for your interest in joining Mosaic Biz Hub.</p>
        
        <p>After reviewing your application, we currently need additional information to complete your onboarding process. 
        Your application received <strong>${points} points</strong> out of the required 30 points.</p>
        
        <p><strong>Application ID:</strong> ${applicationId}</p>
        
        <p>One of our community growth representatives will be in touch within 2-3 business days to help you complete the verification process.</p>
        
        <p>Thank you for your patience.</p>
        
        <p style="margin-top:30px;font-size:12px;color:#777;">
          Best regards,<br>Mosaic Biz Hub Team
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};


