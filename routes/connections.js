const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const Connection = require('../models/connection');
const User = require('../models/user');

// Send friend request
router.post('/request/:userId', isLoggedIn, async (req, res) => {
  try {
    const recipient = await User.findById(req.params.userId);
    if (!recipient) {
      req.flash('error', 'User not found.');
      return res.redirect('back');
    }
    if (recipient._id.equals(req.user._id)) {
      req.flash('error', 'You cannot send a request to yourself.');
      return res.redirect('back');
    }

    // Check if connection already exists
    const existing = await Connection.findOne({
      $or: [
        { requester: req.user._id, recipient: recipient._id },
        { requester: recipient._id, recipient: req.user._id }
      ]
    });
    if (existing) {
      req.flash('error', 'Connection already exists or is pending.');
      return res.redirect('back');
    }

    const connection = new Connection({
      requester: req.user._id,
      recipient: recipient._id,
      status: 'pending'
    });
    await connection.save();

    req.flash('success', 'Friend request sent!');
    res.redirect(`/users/${recipient._id}`); // you'll need a user profile page
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong.');
    res.redirect('back');
  }
});

// View pending requests (received and sent) - FIXED VERSION
router.get('/requests', isLoggedIn, async (req, res) => {
  try {
    // Get received pending requests
    const received = await Connection.find({
      recipient: req.user._id,
      status: 'pending'
    }).populate('requester', 'name username profile');

    // Get sent pending requests
    const sent = await Connection.find({
      requester: req.user._id,
      status: 'pending'
    }).populate('recipient', 'name username profile');

    // Calculate mutual connections for each received request (safely)
    for (let reqItem of received) {
      if (reqItem.requester && reqItem.requester._id) {
        try {
          const mutualCount = await calculateMutualConnections(req.user._id, reqItem.requester._id);
          reqItem.mutualConnections = mutualCount;
        } catch (err) {
          console.error('Error calculating mutual for request:', err);
          reqItem.mutualConnections = 0;
        }
      } else {
        reqItem.mutualConnections = 0;
      }
    }

    res.render('connections/requests', {
      received,
      sent,
      receivedCount: received.length,
      sentCount: sent.length
    });
  } catch (err) {
    console.error('Error loading requests:', err);
    req.flash('error', 'Could not load requests.');
    res.redirect('/profile');
  }
});

// Helper function for mutual connections
async function calculateMutualConnections(userId1, userId2) {
  try {
    // Get user1's accepted connections
    const user1Connections = await Connection.find({
      $or: [
        { requester: userId1, status: 'accepted' },
        { recipient: userId1, status: 'accepted' }
      ]
    }).populate('requester recipient', '_id');
    
    const user1Ids = user1Connections
      .filter(conn => conn && (conn.requester || conn.recipient))
      .map(conn => {
        if (conn.requester && conn.requester._id.toString() === userId1.toString()) {
          return conn.recipient?._id;
        } else {
          return conn.requester?._id;
        }
      })
      .filter(id => id);
    
    // Get user2's accepted connections
    const user2Connections = await Connection.find({
      $or: [
        { requester: userId2, status: 'accepted' },
        { recipient: userId2, status: 'accepted' }
      ]
    }).populate('requester recipient', '_id');
    
    const user2Ids = user2Connections
      .filter(conn => conn && (conn.requester || conn.recipient))
      .map(conn => {
        if (conn.requester && conn.requester._id.toString() === userId2.toString()) {
          return conn.recipient?._id;
        } else {
          return conn.requester?._id;
        }
      })
      .filter(id => id);
    
    // Return count of mutual connections
    return user1Ids.filter(id1 => 
      user2Ids.some(id2 => id2 && id2.equals(id1))
    ).length;
  } catch (err) {
    console.error('Error in calculateMutualConnections:', err);
    return 0;
  }
}

// Helper function to calculate mutual connections
async function calculateMutualConnections(userId1, userId2) {
  // Get user1's connections
  const user1Connections = await Connection.find({
    $or: [
      { requester: userId1, status: 'accepted' },
      { recipient: userId1, status: 'accepted' }
    ]
  });
  
  const user1Ids = user1Connections.map(c => 
    c.requester.equals(userId1) ? c.recipient : c.requester
  );
  
  // Get user2's connections
  const user2Connections = await Connection.find({
    $or: [
      { requester: userId2, status: 'accepted' },
      { recipient: userId2, status: 'accepted' }
    ]
  });
  
  const user2Ids = user2Connections.map(c =>
    c.requester.equals(userId2) ? c.recipient : c.requester
  );
  
  // Count mutual
  return user1Ids.filter(id => 
    user2Ids.some(tid => tid.equals(id))
  ).length;
}

// Accept a request
router.post('/:id/accept', isLoggedIn, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection || !connection.recipient.equals(req.user._id)) {
      req.flash('error', 'Not authorized.');
      return res.redirect('/connections/requests');
    }
    connection.status = 'accepted';
    await connection.save();
    req.flash('success', 'Connection accepted!');
    res.redirect('/connections/requests');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not accept request.');
    res.redirect('/connections/requests');
  }
});

// Decline a request
router.post('/:id/decline', isLoggedIn, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection || !connection.recipient.equals(req.user._id)) {
      req.flash('error', 'Not authorized.');
      return res.redirect('/connections/requests');
    }
    // Either set status to 'declined' or delete it
    connection.status = 'declined';
    await connection.save();
    // Or delete: await connection.remove();
    req.flash('success', 'Request declined.');
    res.redirect('/connections/requests');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not decline request.');
    res.redirect('/connections/requests');
  }
});

// Get mutual connections count - FIXED VERSION
router.get('/mutual/:userId', isLoggedIn, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.json({ mutualCount: 0 });
    }
    
    // Get current user's accepted connections
    const myConnections = await Connection.find({
      $or: [
        { requester: req.user._id, status: 'accepted' },
        { recipient: req.user._id, status: 'accepted' }
      ]
    }).populate('requester recipient', '_id');
    
    // Safely get current user's connection IDs
    const myConnectionIds = myConnections
      .filter(conn => conn && (conn.requester || conn.recipient))
      .map(conn => {
        if (conn.requester && conn.requester._id.toString() === req.user._id.toString()) {
          return conn.recipient?._id;
        } else {
          return conn.requester?._id;
        }
      })
      .filter(id => id); // Remove any undefined/null values
    
    // Get target user's accepted connections
    const targetConnections = await Connection.find({
      $or: [
        { requester: targetUser._id, status: 'accepted' },
        { recipient: targetUser._id, status: 'accepted' }
      ]
    }).populate('requester recipient', '_id');
    
    // Safely get target user's connection IDs
    const targetConnectionIds = targetConnections
      .filter(conn => conn && (conn.requester || conn.recipient))
      .map(conn => {
        if (conn.requester && conn.requester._id.toString() === targetUser._id.toString()) {
          return conn.recipient?._id;
        } else {
          return conn.requester?._id;
        }
      })
      .filter(id => id); // Remove any undefined/null values
    
    // Count mutual connections
    const mutualCount = myConnectionIds.filter(myId => 
      targetConnectionIds.some(targetId => targetId && targetId.equals(myId))
    ).length;
    
    res.json({ mutualCount });
  } catch (err) {
    console.error('Error calculating mutual connections:', err);
    res.status(500).json({ error: 'Could not calculate mutual connections', mutualCount: 0 });
  }
});

// Cancel a sent request
router.post('/:id/cancel', isLoggedIn, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection || !connection.requester.equals(req.user._id)) {
      req.flash('error', 'Not authorized.');
      return res.redirect('/connections/requests');
    }
    
    // Option 1: Delete the request
    await connection.deleteOne();
    
    // Option 2: Set status to 'cancelled' (if you want to keep history)
    // connection.status = 'cancelled';
    // await connection.save();
    
    req.flash('success', 'Request cancelled.');
    res.redirect('/connections/requests');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not cancel request.');
    res.redirect('/connections/requests');
  }
});

module.exports = router;