require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function reset2FA() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI missing in .env file.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(uri);

    const adminEmail = (process.env.ADMIN_EMAIL).toLowerCase().trim();
    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      console.error(`❌ Admin account (${adminEmail}) not found.`);
      process.exit(1);
    }

    admin.twoFactorSecret = null;
    admin.twoFactorEnabled = false;
    await admin.save();

    console.log('====================================================');
    console.log(`✅ 2FA for Admin (${adminEmail}) has been RESET!`);
    console.log('👉 Next time you log in, you will get a fresh QR code.');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting 2FA:', err.message);
    process.exit(1);
  }
}

reset2FA();