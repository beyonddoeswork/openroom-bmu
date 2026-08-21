const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// 1. GET all threads (Sorted by Hot/Top/New)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { sort = 'hot', tag } = req.query;
    const filter = { isNoted: false };
    if (tag && tag !== 'All') filter.tag = tag;

    let query = Review.find(filter);

    if (sort === 'top') {
      query = query.sort({ score: -1, createdAt: -1 });
    } else if (sort === 'new') {
      query = query.sort({ createdAt: -1 });
    } else {
      // Hot: Pinned first, then sorted by high score & recency
      query = query.sort({ isPinned: -1, score: -1, createdAt: -1 });
    }

    const threads = await query.limit(50).lean();
    res.json({ success: true, count: threads.length, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET a single thread with all its comments
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const thread = await Review.findById(req.params.id);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POST create a new thread
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, body, tag, kind } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Thread content is required' });
    }

    const thread = await Review.create({
      title: title || '',
      body: body.trim(),
      tag: tag || 'General',
      kind: kind || 'discussion',
      author: req.user.name || 'Anonymous Student',
      authorEmail: req.user.email,
      authorRole: req.user.role || 'student',
      avatarColor: req.user.avatarColor || '#131D35'
    });

    res.status(201).json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. POST add a comment/reply to a thread
router.post('/:id/comments', verifyToken, async (req, res) => {
  try {
    const { body, parentCommentId } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty' });
    }

    const thread = await Review.findById(req.params.id);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    if (thread.isLocked) {
      return res.status(403).json({ success: false, message: 'This thread is locked for comments' });
    }

    const newComment = {
      author: req.user.name || 'Day Scholar',
      authorEmail: req.user.email,
      authorRole: req.user.role || 'student',
      avatarColor: req.user.avatarColor || '#131D35',
      body: body.trim(),
      parentCommentId: parentCommentId || null
    };

    thread.comments.push(newComment);
    await thread.save();

    res.status(201).json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. POST vote on a thread (Upvote / Downvote toggle)
router.post('/:id/vote', verifyToken, async (req, res) => {
  try {
    const { voteType } = req.body; // 'up' or 'down'
    const userEmail = req.user.email;
    const thread = await Review.findById(req.params.id);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    // Remove existing votes by this user
    thread.upvotes = thread.upvotes.filter(e => e !== userEmail);
    thread.downvotes = thread.downvotes.filter(e => e !== userEmail);

    // Apply new vote if selected
    if (voteType === 'up') thread.upvotes.push(userEmail);
    if (voteType === 'down') thread.downvotes.push(userEmail);

    thread.score = thread.upvotes.length - thread.downvotes.length;
    await thread.save();

    res.json({ success: true, score: thread.score, upvotes: thread.upvotes.length, downvotes: thread.downvotes.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;