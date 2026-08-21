const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

let mongoServer;

// Admin Seeder that preserves 2FA secrets and customization across reboots
const seedAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL).toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await User.create({
        name: 'OpenRoom Administrator',
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
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Attempt connection to MongoDB Atlas (Production & Local with Atlas URI)
  if (primaryUri && !primaryUri.includes('does-not-exist')) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`[Database] Connecting to primary MongoDB Atlas (Attempts left: ${retries})...`);
        const conn = await mongoose.connect(primaryUri, {
          serverSelectionTimeoutMS: 10000, // Increased timeout to prevent premature fallback
          connectTimeoutMS: 15000,
          family: 4
        });

        console.log('====================================================');
        console.log(`✅ [Database] Permanent Atlas Connection Established!`);
        console.log(`📂 Host: ${conn.connection.host}`);
        console.log(`🗄️  Database: ${conn.connection.name}`);
        console.log('====================================================');

        await seedAdmin();
        return;
      } catch (err) {
        retries -= 1;
        console.warn(`[Database Warning] Atlas connection attempt failed: ${err.message}`);
        if (retries > 0) {
          console.log('[Database] Retrying connection in 3 seconds...');
          await new Promise((res) => setTimeout(res, 3000));
        }
      }
    }
  }

  // 2. Production Safety Guard: Do NOT use in-memory DB in production
  if (isProduction) {
    console.error('❌ [Database Fatal] Unable to connect to MongoDB Atlas in production.');
    console.error('❌ In-memory DB fallback is disabled in production to prevent data loss.');
    console.error('👉 Please verify MONGO_URI in your Render environment variables.');
    process.exit(1);
  }

  // 3. Local Development Fallback (Only active in local dev when no MONGO_URI is given)
  try {
    console.warn('[Database] Running in development mode without Atlas. Launching MongoMemoryServer...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const fallbackUri = mongoServer.getUri();
    
    await mongoose.connect(fallbackUri);
    console.log('====================================================');
    console.log('⚡ [Database] In-Memory Dev MongoDB Active!');
    console.log('⚠️  Note: Data created in this session resets on restart.');
    console.log('====================================================');

    await seedAdmin();
  } catch (memErr) {
    console.error('[Database Fatal Error] Failed to launch embedded DB:', memErr.message);
    process.exit(1);
  }
};

module.exports = connectDB;