const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const Booking = require('../models/booking');
const User = require('../models/user');

// Find travel buddies (users who stayed at the same listings as current user)
router.get('/', isLoggedIn, async (req, res) => {
  try {
    // Get all past trips of current user
    const myPastTrips = await Booking.find({
      guest: req.user._id,
      status: 'booked',
      checkOut: { $lt: new Date() }
    }).populate('listing', 'location country');

    // Collect listing IDs and location strings
    const listingIds = myPastTrips.map(t => t.listing._id);
    const locations = myPastTrips.map(t => `${t.listing.location}, ${t.listing.country}`);

    // Find other users who have bookings at the same listings or same locations
    const buddies = await Booking.aggregate([
      {
        $match: {
          guest: { $ne: req.user._id },
          status: 'booked',
          checkOut: { $lt: new Date() },
          $or: [
            { listing: { $in: listingIds } },
            // For location match, we need to join with listings; easier to do in two steps
          ]
        }
      },
      { $group: { _id: '$guest', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    const buddyIds = buddies.map(b => b._id);
    const buddyUsers = await User.find({ _id: { $in: buddyIds } })
      .populate('profile', 'avatar location')
      .select('name username profile');

    // For location-based matching, we can do a second query
    const locationBuddies = await Booking.aggregate([
      {
        $lookup: {
          from: 'listings',
          localField: 'listing',
          foreignField: '_id',
          as: 'listingInfo'
        }
      },
      { $unwind: '$listingInfo' },
      {
        $match: {
          guest: { $ne: req.user._id },
          status: 'booked',
          checkOut: { $lt: new Date() },
          'listingInfo.location': { $in: locations.map(l => l.split(',')[0]) } // crude match
        }
      },
      { $group: { _id: '$guest', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    const locationBuddyIds = locationBuddies.map(b => b._id);
    const locationBuddyUsers = await User.find({ _id: { $in: locationBuddyIds } })
      .populate('profile', 'avatar location')
      .select('name username profile');

    // Combine and remove duplicates
    const allBuddies = [...buddyUsers, ...locationBuddyUsers];
    const uniqueBuddies = Array.from(new Map(allBuddies.map(b => [b._id.toString(), b])).values());

    res.render('travelBuddies/index', { buddies: uniqueBuddies });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not find travel buddies.');
    res.redirect('/profile');
  }
});

module.exports = router;