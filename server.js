require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const connectDB = require('./src/config/db');
const { initBackgroundJobs } = require('./src/services/cronService');
const { errorHandler } = require('./src/middleware/errorHandler');

const roomRoutes = require('./src/routes/roomRoutes');
const authRoutes = require('./src/routes/authRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const Room = require('./src/models/Room');
const User = require('./src/models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Static Assets (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for API security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests from this IP. Please try again later.' }
});
app.use('/api', limiter);

// Mount API Endpoints
app.use('/api/rooms', roomRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Seed Default Admin & Campus Rooms
async function seedInitialData() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@openroom.edu').toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@BMU2026!';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await User.create({
        name: 'BMU Campus Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        mobile: '+91 124 267 1700',
        branch: 'Administration',
        batchYear: 'Staff',
        avatarColor: '#131D35',
        bio: 'Official OpenRoom System Administrator',
        twoFactorEnabled: false,
        twoFactorSecret: null
      });
      console.log(`[Seed] ✅ Admin account initialized: ${adminEmail}`);
    } else {
      console.log(`[Seed] 🔒 Admin account verified (${adminEmail}). Active 2FA: ${existingAdmin.twoFactorEnabled ? 'ENABLED' : 'PENDING'}`);
    }

    const roomCount = await Room.countDocuments();
    if (roomCount === 0) {
      const BUILDINGS = ['Block A', 'Block B', 'Block C', 'Central Library', 'Innovation Hub'];
      const TYPES = ['Classroom', 'Seminar Hall', 'Study Pod', 'Computer Lab', 'Discussion Room'];
      const batch = [];

      BUILDINGS.forEach((b, bi) => {
        const prefix = b === 'Central Library' ? 'LIB' : b === 'Innovation Hub' ? 'IH' : 'B' + String.fromCharCode(65 + bi);
        const floors = b === 'Central Library' ? 2 : 3;
        for (let f = 1; f <= floors; f++) {
          const roomsOnFloor = b === 'Innovation Hub' ? 3 : 4;
          for (let r = 1; r <= roomsOnFloor; r++) {
            const code = prefix + f + String(r).padStart(2, '0');
            const type = TYPES[(bi + f + r) % TYPES.length];
            const capacity = type === 'Study Pod' ? 6 : type === 'Seminar Hall' ? 60 : 35;
            batch.push({
              code,
              building: b,
              floor: f,
              type,
              capacity,
              status: Math.random() > 0.4 ? 'empty' : 'busy',
              statusChangedAt: new Date(),
              lastUpdated: new Date()
            });
          }
        }
      });
      await Room.insertMany(batch);
      console.log(`[Seed] ✅ Campus directory seeded (${batch.length} rooms).`);
    }
  } catch (err) {
    console.error('[Seed Error]', err.message);
  }
}

// SPA HTML Fallback (Catches all non-API routes and sends index.html)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Production Async Server Bootstrapper
async function startServer() {
  try {
    // 1. Establish database connection first
    await connectDB();

    // 2. Guarantee admin & initial data are seeded in DB
    await seedInitialData();

    // 3. Start auto-reset cron service (releases busy rooms back to empty)
    initBackgroundJobs();

    // 4. Start HTTP Server (Binding to 0.0.0.0 for cloud hosting)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`⚡ OpenRoom Production Server Active`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`👨‍💼 Admin Login: ${process.env.ADMIN_EMAIL || 'admin@openroom.edu'}`);
      console.log(`🔑 Admin Pass:  ${process.env.ADMIN_PASSWORD || 'Admin@BMU2026!'}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal Server Boot Error:', err);
    process.exit(1);
  }
}

startServer();