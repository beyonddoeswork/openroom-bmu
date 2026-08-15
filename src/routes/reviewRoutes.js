const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// 1. Fetch all active reviews/ideas (auto-filtered for active items)
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
  }
});

// 2. Submit Review / Feature Suggestion (Students & Authenticated Users)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { kind, body } = req.body;
    if (!body || body.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message body cannot be empty.' });
    }

    const review = await Review.create({
      author: req.user.name,
      authorEmail: req.user.email,
      authorRole: req.user.role || 'student',
      kind: kind === 'suggestion' ? 'suggestion' : 'review',
      body: body.trim()
    });

    res.status(201).json({ success: true, message: 'Feedback posted successfully!', data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
});

// 3. Admin: Respond to an Idea or Review
router.post('/:id/reply', verifyAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    review.adminReply = {
      message: message.trim(),
      repliedBy: req.user.name || 'BMU Administrator',
      repliedAt: new Date()
    };
    await review.save();

    res.json({ success: true, message: 'Admin reply posted!', data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to post admin reply.' });
  }
});

// 4. Admin: Mark as Noted (Queued for 1-Hour Auto-Purge)
router.post('/:id/note', verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    review.isNoted = true;
    review.notedAt = new Date();
    await review.save();

    res.json({
      success: true,
      message: 'Review marked as Noted. It will automatically be cleaned up in 1 hour to optimize database storage.',
      data: review
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark review as noted.' });
  }
});

// 5. Admin: Manually Delete Review
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }
    res.json({ success: true, message: 'Review removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
});

module.exports = router;