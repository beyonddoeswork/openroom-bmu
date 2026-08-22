const cron = require('node-cron');
const Room = require('../models/Room');
const Review = require('../models/Review');

const initBackgroundJobs = () => {
  // 1. Minute-by-Minute Real-Time Schedule Clock
  // Syncs room states with AI weekly schedules as classes start and conclude
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHour}:${currentMin}`;

      const rooms = await Room.find({ 'weeklySchedule.0': { $exists: true } });

      for (const room of rooms) {
        // Evaluate if a scheduled slot is running right now
        const isBookedNow = room.weeklySchedule.some(slot => {
          return slot.day === currentDay && currentTime >= slot.startTime && currentTime < slot.endTime;
        });

        const targetStatus = isBookedNow ? 'busy' : 'empty';

        if (room.status !== targetStatus) {
          room.status = targetStatus;
          room.statusChangedAt = new Date();
          room.lastUpdated = new Date();
          await room.save();
          console.log(`[AI Timetable Engine] ⏱️ Room ${room.code} switched to '${targetStatus}' for ${currentDay} ${currentTime}`);
        }
      }
    } catch (scheduleErr) {
      console.error('[Cron Error: AI Schedule Sync]', scheduleErr.message);
    }
  });

  // 2. Crowdsource Decay: Auto-reset manually voted rooms back to empty after 90 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000);
      const result = await Room.updateMany(
        { 
          status: 'busy', 
          statusChangedAt: { $lte: ninetyMinutesAgo },
          // Only decay if there is no active scheduled class right now
          weeklySchedule: { $size: 0 } 
        },
        { $set: { status: 'empty', statusChangedAt: new Date(), lastUpdated: new Date() } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Cron Job] 🔄 Auto-reset ${result.modifiedCount} crowdsourced room(s) back to empty.`);
      }
    } catch (err) {
      console.error('[Cron Error: Room Reset]', err.message);
    }
  });

  // 3. Auto-purge "Noted" reviews older than 1 hour (60 minutes) to save storage
  cron.schedule('*/5 * * * *', async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const purgeResult = await Review.deleteMany({
        isNoted: true,
        notedAt: { $lte: oneHourAgo }
      });
      if (purgeResult.deletedCount > 0) {
        console.log(`[Cron Job] 🗑️ Cleaned up ${purgeResult.deletedCount} noted review(s) older than 1 hour.`);
      }
    } catch (err) {
      console.error('[Cron Error: Review Purge]', err.message);
    }
  });

  console.log('[Background Service] ⏱️ AI Schedule Clock (1m), Crowd Decay (90m), & Review Purge (60m) Active.');
};

module.exports = { initBackgroundJobs };