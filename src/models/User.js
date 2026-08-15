const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  mobile: { type: String, default: 'N/A', trim: true },
  branch: { type: String, default: 'B.Tech CSE', trim: true },
  batchYear: { type: String, default: '2026', trim: true },
  avatarColor: { type: String, default: '#118A5E' },
  bio: { type: String, default: 'BMU Day Scholar', trim: true },
  // Two-Factor Authentication Fields
  twoFactorSecret: { type: String, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);