require('dotenv').config();
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');

const Room = require('../models/Room');
const { verifyToken, verifyAdmin, optionalAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// 1. Campus AI Chatbot Query Endpoint
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!apiKey) {
      console.error('[AI Chatbot] GEMINI_API_KEY is missing in your .env file.');
      return res.status(500).json({ 
        success: false, 
        message: 'GEMINI_API_KEY is missing in the server .env file.' 
      });
    }

    const body = req.body || {};
    const message = (body.message || '').trim();

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message prompt is required.' });
    }

    // Pull current live records from MongoDB
    const allRooms = await Room.find().lean();
    const freeRooms = allRooms.filter(r => r.status === 'empty');
    const occupiedRooms = allRooms.filter(r => r.status === 'busy');

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const systemInstruction = `
You are "OpenRoom AI", the smart campus assistant for BML Munjal University (BMU).
Help students and day scholars find free classrooms, study pods, library zones, and understand room bookings.

LIVE CAMPUS REAL-TIME STATUS:
- Current Day: ${currentDay}
- Current Time: ${currentTime}
- Total Rooms Tracked: ${allRooms.length}
- Free Rooms Now (${freeRooms.length}): ${freeRooms.map(r => `${r.code} (${r.building}, Fl ${r.floor}, ${r.type}, ${r.capacity} seats)`).join(', ')}
- Occupied Rooms Now (${occupiedRooms.length}): ${occupiedRooms.map(r => r.code).join(', ')}

CAMPUS DIRECTORY & SCHEDULES:
${JSON.stringify(allRooms.map(r => ({
  code: r.code,
  building: r.building,
  floor: r.floor,
  type: r.type,
  capacity: r.capacity,
  status: r.status,
  weeklySchedule: r.weeklySchedule
})))}

Be direct, helpful, and concise. Format room recommendations in clean bullet points.
`;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
      config: {
        systemInstruction
      }
    });

    res.json({ success: true, reply: response.text });
  } catch (err) {
    console.error('=== [AI Chatbot Backend Error] ===\n', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Gemini API call failed.' 
    });
  }
});

// 2. Admin AI Timetable Extraction (.md)
router.post('/upload-timetable', verifyToken, verifyAdmin, upload.single('timetableFile'), async (req, res) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is missing in server environment.' });
    }

    let mdContent = '';
    if (req.file) {
      mdContent = req.file.buffer.toString('utf-8');
    } else if (req.body && req.body.markdownText) {
      mdContent = req.body.markdownText;
    } else {
      return res.status(400).json({ success: false, message: 'Please provide a .md file or raw Markdown text.' });
    }

    const prompt = `
Analyze the university timetable text provided below.
Extract all classrooms/study pods and their booked weekly schedule slots.

Permitted Buildings:
- "E-2 Building"
- "Gateway Building"
- "Central Library"
- "Innovation Hub"

Permitted Types: Classroom, Seminar Hall, Study Pod, Computer Lab, Discussion Room.
Permitted Days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
Time format: Strict 24-hour "HH:mm" (e.g., "09:00", "13:30").

Return ONLY a JSON object with this exact structure (no Markdown fences, no extra text):
{
  "rooms": [
    {
      "code": "E2-101",
      "building": "E-2 Building",
      "floor": 1,
      "type": "Classroom",
      "capacity": 40,
      "weeklySchedule": [
        {
          "day": "Monday",
          "startTime": "09:00",
          "endTime": "10:30",
          "subject": "Data Structures"
        }
      ]
    }
  ]
}

TIMETABLE TEXT:
${mdContent}
`;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsedData = JSON.parse(response.text.trim());
    const extractedRooms = parsedData.rooms || [];

    if (!extractedRooms.length) {
      return res.status(422).json({ success: false, message: 'No rooms could be extracted from this timetable.' });
    }

    // 1. Clear obsolete room collection
    await Room.deleteMany({});

    // 2. Prepare and sanitize room objects with guaranteed defaults
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const validBuildings = ['E-2 Building', 'Gateway Building', 'Central Library', 'Innovation Hub'];
    const validTypes = ['Classroom', 'Seminar Hall', 'Study Pod', 'Computer Lab', 'Discussion Room'];

    const preparedRooms = extractedRooms.map(r => {
      const code = (r.code || 'ROOM-001').toUpperCase().trim();

      // Ensure valid building
      let building = r.building;
      if (!validBuildings.includes(building)) {
        if (code.startsWith('GW') || code.startsWith('GB')) building = 'Gateway Building';
        else if (code.startsWith('LIB')) building = 'Central Library';
        else if (code.startsWith('IH')) building = 'Innovation Hub';
        else building = 'E-2 Building';
      }

      // Ensure valid type
      let type = r.type;
      if (!validTypes.includes(type)) {
        type = 'Classroom';
      }

      // Ensure valid floor
      let floor = parseInt(r.floor, 10);
      if (isNaN(floor) || floor < 1 || floor > 5) {
        const digits = code.replace(/\D/g, '');
        floor = digits.length > 0 ? parseInt(digits[0], 10) : 1;
        if (isNaN(floor) || floor < 1 || floor > 5) floor = 1;
      }

      // Safe capacity fallback
      let capacity = parseInt(r.capacity, 10);
      if (isNaN(capacity) || capacity <= 0) {
        capacity = type === 'Study Pod' ? 6 : type === 'Seminar Hall' ? 60 : 35;
      }

      // Format weekly schedule array
      const weeklySchedule = Array.isArray(r.weeklySchedule) ? r.weeklySchedule.map(slot => ({
        day: slot.day || 'Monday',
        startTime: slot.startTime || '09:00',
        endTime: slot.endTime || '10:30',
        subject: slot.subject || 'Class Session'
      })) : [];

      const isBookedNow = weeklySchedule.some(slot => {
        return slot.day === currentDay && currentTime >= slot.startTime && currentTime < slot.endTime;
      });

      return {
        code,
        building,
        floor,
        type,
        capacity,
        weeklySchedule,
        status: isBookedNow ? 'busy' : 'empty',
        statusChangedAt: new Date(),
        lastUpdated: new Date()
      };
    });

    const inserted = await Room.insertMany(preparedRooms);

    res.json({
      success: true,
      message: `AI successfully analyzed timetable. Seeded ${inserted.length} rooms with automated schedule tracking.`,
      count: inserted.length,
      rooms: inserted
    });
  } catch (err) {
    console.error('=== [AI Timetable Backend Error] ===\n', err);
    res.status(500).json({ success: false, message: 'AI extraction failed: ' + err.message });
  }
});

module.exports = router;