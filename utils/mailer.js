const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,     // your email
    pass: process.env.MAIL_PASSWORD, // app password
  },
});

exports.sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
};

exports.sendWelcomeEmail = async (to, firstName) => {
  const mailOptions = {
    from: `"Mosaic Biz Hub" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Welcome to Mosaic Biz Hub — Grow your business and build generational wealth',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hi ${firstName},</p>
        
        <p>Welcome to <strong>Mosaic Biz Hub</strong> — we're glad you joined. You didn't just create an account; you joined a purpose-driven marketplace built to help businesses gain visibility, attract loyal customers, and scale confidently.</p>
        
        <h3>How Mosaic will help your business grow</h3>
        <ul>
          <li><strong>Get discovered</strong> — curated placement, searchable profiles, and category features that put your business in front of buyers actively looking to support independent brands.</li>
          <li><strong>Sell smarter</strong> — conversion-focused storefront tools, simplified onboarding, and clear analytics so you can increase revenue without extra guesswork.</li>
          <li><strong>Build credibility</strong> — verified badges, peer reviews, and an outcomes-driven recognition system that increases trust and repeat business.</li>
          <li><strong>Access resources and networks</strong> — including educational materials, mentorship initiatives, and partnership opportunities that facilitate connections to funding, expert guidance, and expanded markets.</li>
          <li><strong>Track progress</strong> — an easy vendor dashboard with starter KPIs so you can measure growth, test offers, and celebrate milestones.</li>
        </ul>
        
        <h3>How joining supports our community and long-term wealth</h3>
        <ul>
          <li>We design features to strengthen local economies and circulate value within neighborhoods.</li>
          <li>We amplify founder stories through editorial spotlights and community events that drive customers to mission-led businesses.</li>
          <li>We focus on sustainable growth: more customers, stronger brands, and steps toward generational wealth for business owners and their families.</li>
        </ul>
        
        <h3>Quick next steps</h3>
        <ol>
          <li>Complete your profile and upload a primary product or service to improve discoverability.</li>
          <li>Explore your vendor dashboard and review the starter analytics we prepared for you.</li>
          <li>Reply to this email with the single biggest challenge you want to solve in the next 90 days so we can connect you to targeted resources and partners.</li>
        </ol>
        
        <p>Your feedback shapes Mosaic Biz Hub. If you want to be an early voice in building this movement, reply now and tell us where to focus first.</p>
        
        <p>Welcome to the movement — let's build something that lasts.</p>
        
        <p>Warm regards,<br>
        <strong>Bryan Harris</strong><br>
        Founder, Mosaic Biz Hub</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

