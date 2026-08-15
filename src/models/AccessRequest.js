const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  bmuEmail: { type: String, required: true, lowercase: true, trim: true },
  mobile: { type: String, default: 'N/A', trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  provisionedEmail: { type: String, default: null },
  temporaryPassword: { type: String, default: null }, // Auto-saved to Excel
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AccessRequest', accessRequestSchema);