const cron = require('node-cron');
const Room = require('../models/Room');
const Review = require('../models/Review');

const initBackgroundJobs = () => {
  // 1. Auto-reset occupied rooms back to empty after 90 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000);
      const result = await Room.updateMany(
        { status: 'busy', statusChangedAt: { $lte: ninetyMinutesAgo } },
        { $set: { status: 'empty', statusChangedAt: new Date(), lastUpdated: new Date() } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Cron Job] 🔄 Auto-reset ${result.modifiedCount} rooms back to empty.`);
      }
    } catch (err) {
      console.error('[Cron Error: Room Reset]', err.message);
    }
  });

  // 2. Auto-purge "Noted" reviews older than 1 hour (60 minutes) to save storage
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

  console.log('[Background Service] ⏱️ Room auto-reset (90m) & Review auto-purge (60m) active.');
};

module.exports = { initBackgroundJobs };