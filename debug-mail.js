require('dotenv').config();
const nodemailer = require('nodemailer');

async function testGmail() {
  console.log('--- Testing Gmail SMTP Settings ---');
  console.log('USER:', process.env.SMTP_USER);
  console.log('PASS:', process.env.SMTP_PASS ? `[${process.env.SMTP_PASS.length} chars length]` : 'MISSING!');

  const transporter = nodemailer.createTransport({
    service: 'gmail', // Built-in preset for Gmail
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    console.log('\n1. Verifying credentials with Google...');
    await transporter.verify();
    console.log('✅ Connected and authorized with Google SMTP successfully!');

    console.log('\n2. Sending test email to:', process.env.SMTP_USER);
    const info = await transporter.sendMail({
      from: `"OpenRoom BMU" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'OpenRoom BMU Test Email',
      text: 'If you see this, your Gmail SMTP is 100% working!'
    });

    console.log('🎉 Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (err) {
    console.error('\n❌ Google SMTP Error Details:');
    console.error(err);
  }
}

testGmail();