const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Room = require('../models/Room');

router.post('/', async (req, res) => {
  try {
    const { roomCode, note, author } = req.body;
    const room = await Room.findOne({ code: roomCode.toUpperCase() });

    if (room) {
      room.status = 'busy';
      room.statusChangedAt = new Date();
      room.lastUpdated = new Date();
      await room.save();
    }

    const report = await Report.create({
      roomCode: roomCode.toUpperCase(),
      building: room ? room.building : 'Campus',
      note: note || 'Class in progress',
      reportedBy: author || 'Day Scholar'
    });

    // Find closest available alternative
    let alt = null;
    if (room) {
      alt = await Room.findOne({ status: 'empty', building: room.building, code: { $ne: room.code } });
      if (!alt) {
        alt = await Room.findOne({ status: 'empty', code: { $ne: room.code } });
      }
    }

    res.json({
      success: true,
      message: 'Report logged. Room status set to occupied.',
      data: report,
      alternativeRoom: alt
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit report.' });
  }
});

module.exports = router;