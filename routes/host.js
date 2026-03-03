const express = require("express");
const router = express.Router();
const { requireHost } = require("../middleware");
const Listing = require("../models/listing");
const Booking = require("../models/booking");

// Host Dashboard - Today (Only show host's own reservations)
router.get("/today", requireHost, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Get ONLY THIS HOST's listings
        const hostListings = await Listing.find({ owner: req.user._id });
        const listingIds = hostListings.map(l => l._id);
        
        // Get today's check-ins for ONLY THIS HOST's listings
        // FIXED: Changed 'user' to 'guest' in populate
        const todayCheckIns = await Booking.find({
            listing: { $in: listingIds },
            checkIn: { $gte: today, $lt: tomorrow }
        })
        .populate('listing')
        .populate('guest', 'username email'); // ✅ Changed from 'user' to 'guest'
        
        // Get today's check-outs for ONLY THIS HOST's listings
        // FIXED: Changed 'user' to 'guest' in populate
        const todayCheckOuts = await Booking.find({
            listing: { $in: listingIds },
            checkOut: { $gte: today, $lt: tomorrow }
        })
        .populate('listing')
        .populate('guest', 'username email'); // ✅ Changed from 'user' to 'guest'
        
        // Get upcoming reservations for ONLY THIS HOST's listings
        // FIXED: Changed 'user' to 'guest' in populate
        const upcomingReservations = await Booking.find({
            listing: { $in: listingIds },
            checkIn: { $gt: tomorrow }
        })
        .populate('listing')
        .populate('guest', 'username email') // ✅ Changed from 'user' to 'guest'
        .sort({ checkIn: 1 })
        .limit(10);
        
        res.render("host/today", {
            todayCheckIns,
            todayCheckOuts,
            upcomingReservations,
            currentPath: '/host/today',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/today');
    }
});

// Host Listings Management - ONLY show host's own listings
router.get("/listings", requireHost, async (req, res) => {
    try {
        // Get ONLY THIS HOST's listings
        const listings = await Listing.find({ owner: req.user._id })
            .populate({
                path: 'reviews',
                populate: { path: 'author', select: 'username' } // ✅ Added author populate for reviews
            });
        
        // Calculate average ratings for each listing
        for (let listing of listings) {
            if (listing.reviews && listing.reviews.length > 0) {
                const totalRating = listing.reviews.reduce((sum, review) => sum + review.rating, 0);
                listing.avgRating = (totalRating / listing.reviews.length).toFixed(1);
            } else {
                listing.avgRating = null;
            }
        }
        
        res.render("host/listings", { 
            listings,
            currentPath: '/host/listings',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/listings');
    }
});

// Host Calendar - ONLY show host's own listings and their bookings
router.get("/calendar", requireHost, async (req, res) => {
    try {
        // Get ONLY THIS HOST's listings
        const listings = await Listing.find({ owner: req.user._id });
        const listingIds = listings.map(l => l._id);
        
        // Get bookings for ONLY THIS HOST's listings
        // FIXED: Changed 'user' to 'guest' in populate
        const bookings = await Booking.find({
            listing: { $in: listingIds }
        })
        .populate('listing')
        .populate('guest', 'username email'); // ✅ Changed from 'user' to 'guest'
        
        res.render("host/calendar", { 
            listings,
            bookings,
            currentPath: '/host/calendar',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/calendar');
    }
});

// Host Messages - ONLY show messages for host's own listings
router.get("/messages", requireHost, async (req, res) => {
    try {
        // Get ONLY THIS HOST's listings
        const listings = await Listing.find({ owner: req.user._id });
        const listingIds = listings.map(l => l._id);
        
        // You can implement messages later
        res.render("host/messages", { 
            conversations: [],
            listings: listings,
            currentPath: '/host/messages',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/messages');
    }
});

module.exports = router;