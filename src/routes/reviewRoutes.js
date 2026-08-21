const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// 1. GET all reviews & discussions
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ isPinned: -1, score: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. POST create a new thread / review
router.post('/', verifyToken, async (req, res) => {
  try {
    const { body, kind, tag } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    const review = await Review.create({
      author: req.user.name || 'BMU Day Scholar',
      authorEmail: req.user.email,
      authorRole: req.user.role || 'student',
      avatarColor: req.user.avatarColor || '#131D35',
      kind: kind || 'review',
      tag: tag || 'General',
      body: body.trim(),
      comments: []
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POST add a comment / reply to a thread
router.post('/:id/comments', verifyToken, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Reply cannot be empty.' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Discussion thread not found.' });
    }

    const comment = {
      author: req.user.name || 'Day Scholar',
      authorEmail: req.user.email,
      authorRole: req.user.role || 'student',
      avatarColor: req.user.avatarColor || '#131D35',
      body: body.trim(),
      createdAt: new Date()
    };

    review.comments.push(comment);
    await review.save();

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. POST upvote a thread
router.post('/:id/vote', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Discussion thread not found.' });
    }

    const hasUpvoted = review.upvotes.includes(userEmail);
    if (hasUpvoted) {
      review.upvotes = review.upvotes.filter((e) => e !== userEmail);
    } else {
      review.upvotes.push(userEmail);
      review.downvotes = review.downvotes.filter((e) => e !== userEmail);
    }

    review.score = review.upvotes.length - review.downvotes.length;
    await review.save();

    res.json({ success: true, score: review.score, upvoted: !hasUpvoted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. POST official Admin reply
router.post('/:id/reply', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Thread not found.' });

    review.adminReply = {
      message: message.trim(),
      repliedBy: req.user.name || 'BMU Administrator',
      repliedAt: new Date()
    };

    await review.save();
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. POST mark thread as noted
router.post('/:id/note', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Thread not found.' });

    review.isNoted = true;
    review.notedAt = new Date();
    await review.save();

    res.json({ success: true, message: 'Marked as noted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. DELETE thread (Author or Admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Thread not found.' });
    }

    // Allow deletion if user is an Admin OR the original post author
    const isOwner = review.authorEmail && req.user.email && review.authorEmail.toLowerCase() === req.user.email.toLowerCase();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this post.' });
    }

    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. DELETE comment (Comment Author or Admin)
router.delete('/:id/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Thread not found.' });
    }

    const comment = review.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const isCommentOwner = comment.authorEmail && req.user.email && comment.authorEmail.toLowerCase() === req.user.email.toLowerCase();
    const isAdmin = req.user.role === 'admin';

    if (!isCommentOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this reply.' });
    }

    comment.deleteOne();
    await review.save();

    res.json({ success: true, message: 'Reply deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;