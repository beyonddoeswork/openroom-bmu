const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, uppercase: true },
  building: { type: String, required: true },
  note: { type: String, default: 'Class in progress / room occupied' },
  reportedBy: { type: String, default: 'Anonymous Day Scholar' },
  reportedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);