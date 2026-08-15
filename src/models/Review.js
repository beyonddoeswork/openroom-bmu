const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  author: { type: String, required: true, trim: true },
  authorEmail: { type: String, default: null },
  authorRole: { type: String, default: 'student' },
  kind: { type: String, enum: ['review', 'suggestion'], default: 'review' },
  body: { type: String, required: true, trim: true },
  // Official Admin Response
  adminReply: {
    message: { type: String, default: null },
    repliedBy: { type: String, default: null },
    repliedAt: { type: Date, default: null }
  },
  // "Noted" Lifecycle & Auto-Purge
  isNoted: { type: Boolean, default: false },
  notedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);