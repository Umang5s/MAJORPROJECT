const express = require("express");
const router = express.Router();
const { requireHost } = require("../middleware");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const BlockedDate = require("../models/blockedDate");
const PriceOverride = require("../models/priceOverride");

// ============== HOST DASHBOARD ROUTES ==============

// Host Dashboard - Today
router.get("/today", requireHost, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Get ONLY THIS HOST's listings
        const hostListings = await Listing.find({ owner: req.user._id });
        const listingIds = hostListings.map(l => l._id);
        
        // Get today's check-ins
        const todayCheckIns = await Booking.find({
            listing: { $in: listingIds },
            checkIn: { $gte: today, $lt: tomorrow }
        })
        .populate('listing')
        .populate('guest', 'username email');
        
        // Get today's check-outs
        const todayCheckOuts = await Booking.find({
            listing: { $in: listingIds },
            checkOut: { $gte: today, $lt: tomorrow }
        })
        .populate('listing')
        .populate('guest', 'username email');
        
        // Get upcoming reservations
        const upcomingReservations = await Booking.find({
            listing: { $in: listingIds },
            checkIn: { $gt: tomorrow }
        })
        .populate('listing')
        .populate('guest', 'username email')
        .sort({ checkIn: 1 })
        .limit(10);
        
        // Get recent earnings
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        
        const monthlyBookings = await Booking.find({
            listing: { $in: listingIds },
            checkIn: { $gte: currentMonth },
            status: 'confirmed'
        });
        
        const monthlyEarnings = monthlyBookings.reduce((sum, booking) => {
            return sum + (booking.price || 0);
        }, 0);
        
        res.render("host/today", {
            todayCheckIns,
            todayCheckOuts,
            upcomingReservations,
            monthlyEarnings,
            currentPath: '/host/today',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/today');
    }
});

// Host Listings Management
router.get("/listings", requireHost, async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.user._id })
            .populate({
                path: 'reviews',
                populate: { path: 'author', select: 'username' }
            });
        
        // Calculate average ratings
        for (let listing of listings) {
            if (listing.reviews && listing.reviews.length > 0) {
                const totalRating = listing.reviews.reduce((sum, review) => sum + review.overallRating, 0);
                listing.avgRating = (totalRating / listing.reviews.length).toFixed(1);
            } else {
                listing.avgRating = null;
            }
            
            // Get booking count for this listing
            const bookingsCount = await Booking.countDocuments({ 
                listing: listing._id,
                status: 'confirmed'
            });
            listing.bookingsCount = bookingsCount;
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

// Host Calendar
router.get("/calendar", requireHost, async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.user._id });
        const listingIds = listings.map(l => l._id);
        
        const bookings = await Booking.find({
            listing: { $in: listingIds }
        })
        .populate('listing')
        .populate('guest', 'username email');
        
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

// ============== CALENDAR API ROUTES ==============

// Get blocked dates for a specific listing and month
router.get("/calendar/blocked-dates", requireHost, async (req, res) => {
    try {
        const { listingId, year, month } = req.query;
        
        console.log(`[SERVER] Fetching blocked dates for listing: ${listingId}, year: ${year}, month: ${month}`);
        
        // Verify listing belongs to host
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            console.log(`[SERVER] Unauthorized access attempt for listing: ${listingId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Create date range for the month
        const startDate = new Date(year, month - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);
        
        console.log(`[SERVER] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        const blockedDates = await BlockedDate.find({
            listing: listingId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        console.log(`[SERVER] Found ${blockedDates.length} blocked dates`);
        
        // Format dates as YYYY-MM-DD
        const formattedBlockedDates = blockedDates.map(b => {
            const date = new Date(b.date);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        });
        
        console.log('[SERVER] Formatted blocked dates:', formattedBlockedDates);
        
        res.json({ 
            blockedDates: formattedBlockedDates
        });
    } catch (error) {
        console.error('[SERVER] Error fetching blocked dates:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get price overrides for a specific listing and month
router.get("/calendar/price-overrides", requireHost, async (req, res) => {
    try {
        const { listingId, year, month } = req.query;
        
        console.log(`[SERVER] Fetching price overrides for listing: ${listingId}, year: ${year}, month: ${month}`);
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const startDate = new Date(year, month - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);
        
        const priceOverrides = await PriceOverride.find({
            listing: listingId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        console.log(`[SERVER] Found ${priceOverrides.length} price overrides`);
        
        const formattedPriceOverrides = priceOverrides.map(p => {
            const date = new Date(p.date);
            return {
                date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                price: p.price
            };
        });
        
        res.json({ 
            priceOverrides: formattedPriceOverrides
        });
    } catch (error) {
        console.error('[SERVER] Error fetching price overrides:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Block or unblock a specific date
router.post("/calendar/block-date", requireHost, async (req, res) => {
    try {
        const { listingId, date, blocked } = req.body;
        
        console.log(`[SERVER] Saving blocked date: ${date}, blocked: ${blocked}, listing: ${listingId}`);
        
        // Verify listing belongs to host
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            console.log(`[SERVER] Unauthorized access attempt for listing: ${listingId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Parse the date correctly from YYYY-MM-DD format
        const [year, month, day] = date.split('-').map(Number);
        
        // Create date in UTC noon to avoid timezone issues
        const blockDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        
        console.log(`[SERVER] Parsed date: ${blockDate.toISOString()}`);
        
        if (blocked) {
            // Block the date
            await BlockedDate.findOneAndUpdate(
                { listing: listingId, date: blockDate },
                { listing: listingId, date: blockDate },
                { upsert: true }
            );
            console.log(`[SERVER] Date ${date} blocked successfully`);
        } else {
            // Unblock the date
            await BlockedDate.deleteOne({ 
                listing: listingId, 
                date: blockDate 
            });
            console.log(`[SERVER] Date ${date} unblocked successfully`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[SERVER] Error saving blocked date:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update price for a specific date
router.post("/calendar/update-price", requireHost, async (req, res) => {
    try {
        const { listingId, date, price } = req.body;
        
        console.log(`[SERVER] Saving price override: ${date}, price: ${price}, listing: ${listingId}`);
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Parse the date correctly from YYYY-MM-DD format
        const [year, month, day] = date.split('-').map(Number);
        
        // Create date in UTC noon to avoid timezone issues
        const priceDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        
        await PriceOverride.findOneAndUpdate(
            { listing: listingId, date: priceDate },
            { listing: listingId, date: priceDate, price: price },
            { upsert: true }
        );
        
        console.log(`[SERVER] Price override for ${date} saved successfully`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[SERVER] Error saving price override:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============== MESSAGES ROUTES ==============

// Host Messages
router.get("/messages", requireHost, async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.user._id });
        
        // Get recent conversations (you'll implement this)
        const conversations = [];
        
        res.render("host/messages", { 
            conversations,
            listings,
            currentPath: '/host/messages',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/messages');
    }
});

// ============== ANALYTICS ROUTES ==============

// Host Analytics
router.get("/analytics", requireHost, async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.user._id });
        const listingIds = listings.map(l => l._id);
        
        // Get last 6 months of data
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        
        const bookings = await Booking.find({
            listing: { $in: listingIds },
            checkIn: { $gte: sixMonthsAgo },
            status: 'confirmed'
        }).populate('listing');
        
        // Calculate analytics
        const monthlyData = {};
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = month.toLocaleDateString('default', { month: 'short', year: 'numeric' });
            monthlyData[monthKey] = {
                bookings: 0,
                revenue: 0,
                occupancy: 0
            };
        }
        
        let totalRevenue = 0;
        let totalBookings = bookings.length;
        
        bookings.forEach(booking => {
            const monthKey = booking.checkIn.toLocaleDateString('default', { month: 'short', year: 'numeric' });
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].bookings++;
                monthlyData[monthKey].revenue += booking.price || 0;
            }
            totalRevenue += booking.price || 0;
        });
        
        res.render("host/analytics", {
            monthlyData,
            totalRevenue,
            totalBookings,
            listingsCount: listings.length,
            currentPath: '/host/analytics',
            layout: 'layouts/boilerplate'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong');
        res.redirect('/host/analytics');
    }
});

module.exports = router;