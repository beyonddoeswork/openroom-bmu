const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  building: { type: String, required: true, trim: true },
  floor: { type: Number, required: true },
  type: { type: String, required: true, enum: ['Classroom', 'Seminar Hall', 'Study Pod', 'Computer Lab', 'Discussion Room'] },
  capacity: { type: Number, required: true },
  status: { type: String, enum: ['empty', 'busy'], default: 'empty' },
  busyVotes: [{
    ipOrUserId: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  statusChangedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);