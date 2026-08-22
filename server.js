require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const connectDB = require('./src/config/db');
const { initBackgroundJobs } = require('./src/services/cronService');

const roomRoutes = require('./src/routes/roomRoutes');
const authRoutes = require('./src/routes/authRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const Room = require('./src/models/Room');
const User = require('./src/models/User');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');

// Trust reverse proxy (Required for Render & express-rate-limit)
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// 1. Body Parsing Middlewares (MUST BE BEFORE ANY ROUTE MOUNTS)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Explicitly serve static assets
app.use(express.static(PUBLIC_DIR));

// 3. API Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP. Please try again later.' }
});
app.use('/api', limiter);

// 4. Mount API Endpoints (All parsed cleanly)
app.use('/api/rooms', roomRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// 5. Seed Initial Admin & Campus Rooms
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
      console.log(`[Seed] 🔒 Admin account verified (${adminEmail}).`);
    }

    const roomCount = await Room.countDocuments();
    if (roomCount === 0) {
      const BUILDINGS = ['E-2 Building', 'Gateway Building', 'Central Library', 'Innovation Hub'];
      const TYPES = ['Classroom', 'Seminar Hall', 'Study Pod', 'Computer Lab', 'Discussion Room'];
      const batch = [];

      BUILDINGS.forEach((b, bi) => {
        let prefix = 'E2-';
        let floors = 3;

        if (b === 'Gateway Building') {
          prefix = 'GW-';
          floors = 3;
        } else if (b === 'Central Library') {
          prefix = 'LIB-';
          floors = 2;
        } else if (b === 'Innovation Hub') {
          prefix = 'IH-';
          floors = 3;
        }

        for (let f = 1; f <= floors; f++) {
          const roomsOnFloor = b === 'Innovation Hub' ? 3 : 4;
          for (let r = 1; r <= roomsOnFloor; r++) {
            const code = `${prefix}${f}${String(r).padStart(2, '0')}`;
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
      console.log(`[Seed] ✅ Campus directory seeded with new buildings (${batch.length} rooms).`);
    }
  } catch (err) {
    console.error('[Seed Error]', err.message);
  }
}

// 6. Explicit Root and Catch-All Handler (Ensures index.html always loads)
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// 7. Async Server Bootstrapper
async function startServer() {
  try {
    await connectDB();
    await seedInitialData();
    initBackgroundJobs();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`⚡ OpenRoom Production Server Active`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`📂 Public Directory: ${PUBLIC_DIR}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal Server Boot Error:', err);
    process.exit(1);
  }
}

startServer();