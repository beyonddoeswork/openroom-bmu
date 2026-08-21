require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function resetAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB...');

  const adminEmail = (process.env.ADMIN_EMAIL ).toLowerCase().trim();
  const rawPassword = process.env.ADMIN_PASSWORD;
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // Upsert admin
  await User.findOneAndUpdate(
    { email: adminEmail },
    {
      name: 'BMU Administrator',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      mobile: '+91 124 267 1700'
    },
    { upsert: true, new: true }
  );

  console.log('==========================================');
  console.log('✅ Admin Account Ready!');
  console.log(`Email:    ${adminEmail}`);
  console.log(`Password: ${rawPassword}`);
  console.log('==========================================');
  process.exit(0);
}

resetAdmin().catch(err => {
  console.error('Error resetting admin:', err);
  process.exit(1);
});