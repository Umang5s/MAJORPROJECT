const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const Message = require('../models/message');
const Conversation = require('../models/conversation');
const User = require('../models/user');

// List all conversations for the logged-in user
router.get('/conversations', isLoggedIn, async (req, res) => {
  try {
    // Find all conversations where user is a participant
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'name username profile')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.render('messages/conversations', { conversations });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load conversations.');
    res.redirect('/profile');
  }
});

// View messages with a specific user (or start a new conversation)
router.get('/with/:userId', isLoggedIn, async (req, res) => {
  try {
    const otherUser = await User.findById(req.params.userId).select('name username profile');
    if (!otherUser) {
      req.flash('error', 'User not found.');
      return res.redirect('/messages/conversations');
    }

    // Fetch messages between the two users, sorted by date
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: otherUser._id },
        { sender: otherUser._id, receiver: req.user._id }
      ]
    }).sort({ createdAt: 1 });

    // Mark all unread messages from otherUser as read
    await Message.updateMany(
      { sender: otherUser._id, receiver: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.render('messages/chat', { otherUser, messages });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load messages.');
    res.redirect('/messages/conversations');
  }
});

// Send a message
router.post('/with/:userId', isLoggedIn, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') {
      req.flash('error', 'Message cannot be empty.');
      return res.redirect(`/messages/with/${req.params.userId}`);
    }

    const receiver = await User.findById(req.params.userId);
    if (!receiver) {
      req.flash('error', 'User not found.');
      return res.redirect('/messages/conversations');
    }

    // Create message
    const message = new Message({
      sender: req.user._id,
      receiver: receiver._id,
      content: content.trim()
    });
    await message.save();

    // Update or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, receiver._id] }
    });
    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, receiver._id],
        lastMessage: message._id
      });
    } else {
      conversation.lastMessage = message._id;
      conversation.updatedAt = Date.now();
    }
    await conversation.save();

    res.redirect(`/messages/with/${req.params.userId}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not send message.');
    res.redirect(`/messages/with/${req.params.userId}`);
  }
});

// Mark messages as read (optional, we already did in GET)
module.exports = router;