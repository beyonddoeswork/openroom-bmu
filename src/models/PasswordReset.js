const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, default: 'Day Scholar Student' },
  bmuEmail: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

module.exports = mongoose.model('PasswordReset', passwordResetSchema);