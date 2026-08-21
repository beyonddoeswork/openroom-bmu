const mongoose = require('mongoose');

// Sub-schema for Reddit-style nested comments/replies
const commentSchema = new mongoose.Schema({
  author: { type: String, required: true, trim: true },
  authorEmail: { type: String, default: null },
  authorRole: { type: String, enum: ['student', 'admin'], default: 'student' },
  avatarColor: { type: String, default: '#131D35' },
  body: { type: String, required: true, trim: true },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Enables nested reply chains
  upvotes: { type: [String], default: [] }, // Array of user emails to prevent duplicate votes
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  title: { type: String, trim: true, default: '' }, // Thread title / subject
  author: { type: String, required: true, trim: true },
  authorEmail: { type: String, default: null },
  authorRole: { type: String, enum: ['student', 'admin'], default: 'student' },
  avatarColor: { type: String, default: '#131D35' },
  kind: { 
    type: String, 
    enum: ['review', 'suggestion', 'discussion', 'question'], 
    default: 'discussion' 
  },
  tag: { 
    type: String, 
    enum: ['General', 'E-2 Building', 'Gateway Building', 'Library', 'Innovation Hub', 'WiFi/AC', 'Feature Request'], 
    default: 'General' 
  },
  body: { type: String, required: true, trim: true },

  // Reddit-style Upvoting / Downvoting on top-level threads
  upvotes: { type: [String], default: [] },
  downvotes: { type: [String], default: [] },
  score: { type: Number, default: 0 },

  // Threaded peer-to-peer replies
  comments: [commentSchema],

  // Official Admin Response & Lifecycle
  adminReply: {
    message: { type: String, default: null },
    repliedBy: { type: String, default: null },
    repliedAt: { type: Date, default: null }
  },
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isNoted: { type: Boolean, default: false },
  notedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Auto-calculate score on save
reviewSchema.pre('save', function (next) {
  this.score = (this.upvotes?.length || 0) - (this.downvotes?.length || 0);
  next();
});

module.exports = mongoose.model('Review', reviewSchema);