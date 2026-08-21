const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Sends branded credential emails to approved BMU day scholars
 */
const sendCredentialsEmail = async ({ toEmail, studentName, loginEmail, password }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email Warning] SMTP credentials not set in .env. Skipping automated email.');
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || `"OpenRoom BMU" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Welcome to OpenRoom BMU — Your Day Scholar Login Credentials',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #d6deec; border-radius: 10px; background-color: #ffffff;">
        <div style="margin-bottom: 20px; border-bottom: 2px solid #131d35; padding-bottom: 12px;">
          <h2 style="color: #131d35; margin: 0; font-size: 22px;">⚡ OpenRoom — BMU Day Scholar Portal</h2>
        </div>
        
        <p style="font-size: 15px; color: #1e293b;">Hi <b>${studentName}</b>,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">
          Your day scholar access request for <b>BML Munjal University</b> has been approved! You can now log into the portal to check live free classrooms, study pods, and computer labs across campus.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">🔑 Your Account Credentials</h3>
          <p style="margin: 6px 0; font-size: 14px;"><b>Assigned Login:</b> <code style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; color: #0f172a;">${loginEmail}</code></p>
          <p style="margin: 6px 0; font-size: 14px;"><b>Registered BMU Email:</b> <span style="color: #475569;">${toEmail}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><b>Temporary Password:</b> <code style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; color: #0f172a;">${password}</code></p>
        </div>

        <p style="font-size: 13px; color: #64748b;">
          *Note: You can log in using either your assigned <code>@openroom.xyz</code> handle OR your registered BMU email. Please update your password after logging in via the <b>My Account</b> page.
        </p>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
          BML Munjal University &bull; OpenRoom Project
        </div>
      </div>
    `
  };

  try {
    console.log(`[Email Dispatch] Sending credentials to ${toEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Dispatch] ✅ Email successfully sent to ${toEmail}! Message ID: ${info.messageId}`);
  } catch (err) {
    console.error(`[Email Dispatch Error] Failed to send email to ${toEmail}:`, err.message);
  }
};

module.exports = { sendCredentialsEmail };
