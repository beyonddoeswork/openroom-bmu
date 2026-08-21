const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, uppercase: true, trim: true },
  building: { type: String, required: true, trim: true },
  issueType: {
    type: String,
    enum: ['Occupied / Class in Session', 'AC Not Working', 'No Power / Outlets Dead', 'Projector Issue', 'Dirty / Needs Cleaning', 'Other'],
    default: 'Occupied / Class in Session'
  },
  note: { type: String, default: 'Class in progress / room occupied', trim: true },
  reportedBy: { type: String, default: 'Anonymous Day Scholar' },
  reporterEmail: { type: String, default: null },
  
  // Crowd-confirmation ("+1 Confirm" button from other students)
  confirmations: { type: [String], default: [] },
  
  // Resolution lifecycle
  status: { type: String, enum: ['active', 'resolved', 'dismissed'], default: 'active' },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: null },

  reportedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
