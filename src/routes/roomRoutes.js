const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { verifyAdmin } = require('../middleware/auth');

// GET all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ building: 1, floor: 1, code: 1 });
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to fetch room list.' });
  }
});

// Crowd Status Toggle with Memory & Multi-Vote Verification
router.post('/:code/vote', async (req, res) => {
  try {
    const { action } = req.body; // 'empty' or 'busy'
    const identifier = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'client';
    const room = await Room.findOne({ code: req.params.code.toUpperCase() });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found on BMU directory.' });
    }

    if (action === 'empty') {
      room.status = 'empty';
      room.busyVotes = [];
      room.statusChangedAt = new Date();
      room.lastUpdated = new Date();
      await room.save();
      return res.json({ success: true, message: `${room.code} marked empty.`, data: room });
    }

    if (action === 'busy') {
      const threshold = parseInt(process.env.BUSY_VOTE_THRESHOLD || '2');
      const recentVotes = room.busyVotes.filter(v => Date.now() - new Date(v.timestamp).getTime() < 30 * 60 * 1000);
      const alreadyVoted = recentVotes.some(v => v.ipOrUserId === identifier);

      if (!alreadyVoted) {
        recentVotes.push({ ipOrUserId: identifier, timestamp: new Date() });
      }
      room.busyVotes = recentVotes;

      if (room.busyVotes.length >= threshold) {
        room.status = 'busy';
        room.statusChangedAt = new Date();
      }
      room.lastUpdated = new Date();
      await room.save();

      const msg = room.status === 'busy'
        ? `${room.code} is confirmed occupied by students.`
        : `Flag recorded (${room.busyVotes.length}/${threshold} votes needed to flip status).`;

      return res.json({ success: true, message: msg, data: room });
    }

    res.status(400).json({ success: false, message: 'Invalid vote action.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to process room vote.' });
  }
});

// Admin Room Management
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { code, building, floor, type, capacity } = req.body;
    if (!code || !building || !floor || !type || !capacity) {
      return res.status(400).json({ success: false, message: 'All room fields are required.' });
    }
    const existing = await Room.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: `Room ${code} already exists.` });
    }
    const room = await Room.create({
      code: code.toUpperCase(),
      building,
      floor: parseInt(floor),
      type,
      capacity: parseInt(capacity)
    });
    res.status(201).json({ success: true, message: `Room ${room.code} created.`, data: room });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not create room.' });
  }
});

router.delete('/:code', verifyAdmin, async (req, res) => {
  try {
    const room = await Room.findOneAndDelete({ code: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    res.json({ success: true, message: `Room ${room.code} deleted permanently.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete room.' });
  }
});

module.exports = router;