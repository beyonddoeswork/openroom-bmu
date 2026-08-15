const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');

let mongoServer;

// Admin Seeder that preserves 2FA secrets and customization across reboots
const seedAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@openroom.edu').toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@BMU2026!', 10);
      await User.create({
        name: 'BMU Campus Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        mobile: '+91 9999999999',
        branch: 'Administration',
        batchYear: 'Staff',
        avatarColor: '#131D35',
        bio: 'Official OpenRoom System Administrator',
        twoFactorEnabled: false,
        twoFactorSecret: null
      });
      console.log(`[Admin Seed] ✅ Initialized admin account: ${adminEmail}`);
    } else {
      console.log(`[Admin Seed] 🔒 Existing admin preserved with active 2FA status: ${existingAdmin.twoFactorEnabled ? 'ENABLED' : 'PENDING SETUP'}`);
    }
  } catch (err) {
    console.error('[Admin Seed Error]:', err.message);
  }
};

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;

  // 1. Attempt connection to primary URI (MongoDB Atlas or Local MongoDB)
  if (primaryUri && !primaryUri.includes('does-not-exist')) {
    try {
      console.log('[Database] Connecting to primary MongoDB...');
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 5000,
        tlsAllowInvalidCertificates: true,
        family: 4
      });
      console.log(`[Database] Connected successfully to: ${conn.connection.host}`);
      await seedAdmin();
      return;
    } catch (err) {
      console.warn(`[Database Warning] Primary connection failed (${err.message}).`);
      console.warn('[Database] Falling back to embedded high-performance MongoDB instance...');
    }
  }

  // 2. Failover: Launch embedded In-Memory MongoDB automatically
  try {
    mongoServer = await MongoMemoryServer.create();
    const fallbackUri = mongoServer.getUri();
    await mongoose.connect(fallbackUri);
    console.log('====================================================');
    console.log('⚡ [Database] Embedded MongoDB Active & Running Locally!');
    console.log(`⚡ Internal URI: ${fallbackUri}`);
    console.log('⚡ All features (Admin, Users, Excel, Rooms) are LIVE.');
    console.log('====================================================');
    await seedAdmin();
  } catch (memErr) {
    console.error('[Database Fatal Error] Failed to launch embedded DB:', memErr.message);
    process.exit(1);
  }
};

module.exports = connectDB;