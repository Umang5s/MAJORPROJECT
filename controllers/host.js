// controllers/hostController.js
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const BlockedDate = require('../models/blockedDate');
const PriceOverride = require('../models/priceOverride');
const StayRule = require('../models/StayRule');
const SeasonalRule = require('../models/SeasonalRule');
const ExportService = require('../services/exportService');
const SmartPricingService = require('../services/smartPricingService');

// ============== DASHBOARD CONTROLLERS ==============

exports.getTodayDashboard = async (req, res) => {
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
};

exports.getListings = async (req, res) => {
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
};

exports.getCalendar = async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.user._id });
        const listingIds = listings.map(l => l._id);
        
        const bookings = await Booking.find({
            listing: { $in: listingIds },
            status: { $ne: 'cancelled' }
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
};

exports.getMessages = async (req, res) => {
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
};

exports.getAnalytics = async (req, res) => {
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
};

// ============== CALENDAR API CONTROLLERS ==============

exports.getBlockedDates = async (req, res) => {
    try {
        const { listingId, year, month } = req.query;
        
        // Handle 'all' case
        if (listingId === 'all') {
            return res.json({ blockedDates: [] });
        }
        
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
        
        res.json({ blockedDates: formattedBlockedDates });
    } catch (error) {
        console.error('[SERVER] Error fetching blocked dates:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getPriceOverrides = async (req, res) => {
    try {
        const { listingId, year, month } = req.query;
        
        // Handle 'all' case
        if (listingId === 'all') {
            return res.json({ priceOverrides: [] });
        }
        
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
        
        res.json({ priceOverrides: formattedPriceOverrides });
    } catch (error) {
        console.error('[SERVER] Error fetching price overrides:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStayRules = async (req, res) => {
    try {
        const { listingId, year, month } = req.query;
        
        // Handle 'all' case
        if (listingId === 'all') {
            return res.json({ rules: [] });
        }
        
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
        
        const stayRules = await StayRule.find({
            listing: listingId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const formattedStayRules = stayRules.map(r => {
            const date = new Date(r.date);
            return {
                date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                minStay: r.minStay,
                maxStay: r.maxStay,
                checkInDays: r.checkInDays,
                checkOutDays: r.checkOutDays
            };
        });
        
        res.json({ rules: formattedStayRules });
    } catch (error) {
        console.error('[SERVER] Error fetching stay rules:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.saveBlockedDate = async (req, res) => {
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
};

exports.savePriceOverride = async (req, res) => {
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
};

exports.saveStayRule = async (req, res) => {
    try {
        const { listingId, date, minStay, maxStay, checkInDays, checkOutDays } = req.body;
        
        console.log(`[SERVER] Saving stay rule for ${date}`);
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const [year, month, day] = date.split('-').map(Number);
        const ruleDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        
        await StayRule.findOneAndUpdate(
            { listing: listingId, date: ruleDate },
            { 
                listing: listingId, 
                date: ruleDate, 
                minStay: minStay || 1,
                maxStay: maxStay || 365,
                checkInDays: checkInDays || [0,1,2,3,4,5,6],
                checkOutDays: checkOutDays || [0,1,2,3,4,5,6]
            },
            { upsert: true }
        );
        
        console.log(`[SERVER] Stay rule for ${date} saved successfully`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[SERVER] Error saving stay rule:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.updateListingSettings = async (req, res) => {
    try {
        const { listingId } = req.params;
        const updates = req.body;
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Update only allowed fields
        const allowedUpdates = [
            'price', 'weekendPrice', 'weeklyDiscount', 'monthlyDiscount',
            'minNights', 'maxNights', 'advanceNotice', 'preparationTime',
            'availabilityWindow', 'smartPricing'
        ];
        
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                listing[field] = updates[field];
            }
        });
        
        await listing.save();
        
        res.json({ 
            success: true, 
            message: 'Listing settings updated successfully',
            listing
        });
    } catch (error) {
        console.error('[SERVER] Error updating listing settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getListingSettings = async (req, res) => {
    try {
        const { listingId } = req.params;
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        res.json({
            success: true,
            settings: {
                price: listing.price,
                weekendPrice: listing.weekendPrice || listing.price,
                weeklyDiscount: listing.weeklyDiscount || 0,
                monthlyDiscount: listing.monthlyDiscount || 0,
                minNights: listing.minNights || 1,
                maxNights: listing.maxNights || 365,
                advanceNotice: listing.advanceNotice || 'same-day',
                preparationTime: listing.preparationTime || 'none',
                availabilityWindow: listing.availabilityWindow || 12,
                smartPricing: listing.smartPricing || false
            }
        });
    } catch (error) {
        console.error('[SERVER] Error fetching listing settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.bulkUpdateDates = async (req, res) => {
    try {
        const { listingId, dateRange, operation } = req.body;
        const { startDate, endDate } = dateRange;
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const operations = [];
        const currentDate = new Date(startDate);
        const endDateTime = new Date(endDate);
        
        while (currentDate <= endDateTime) {
            // Price update
            if (operation.price !== undefined) {
                operations.push({
                    updateOne: {
                        filter: { listing: listingId, date: currentDate },
                        update: { 
                            $set: { 
                                listing: listingId, 
                                date: currentDate, 
                                price: operation.price 
                            } 
                        },
                        upsert: true
                    }
                });
            }
            
            // Block/Unblock
            if (operation.blocked !== undefined) {
                if (operation.blocked) {
                    operations.push({
                        updateOne: {
                            filter: { listing: listingId, date: currentDate },
                            update: { $set: { listing: listingId, date: currentDate } },
                            upsert: true
                        }
                    });
                } else {
                    operations.push({
                        deleteOne: {
                            filter: { listing: listingId, date: currentDate }
                        }
                    });
                }
            }
            
            // Min/Max stay
            if (operation.minStay !== undefined || operation.maxStay !== undefined) {
                const updateData = { listing: listingId, date: currentDate };
                if (operation.minStay !== undefined) updateData.minStay = operation.minStay;
                if (operation.maxStay !== undefined) updateData.maxStay = operation.maxStay;
                
                operations.push({
                    updateOne: {
                        filter: { listing: listingId, date: currentDate },
                        update: { $set: updateData },
                        upsert: true
                    }
                });
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const results = {
            prices: 0,
            blocks: 0,
            stays: 0
        };
        
        if (operations.length > 0) {
            if (operation.price !== undefined) {
                const priceOps = operations.filter(o => 
                    o.updateOne?.update?.$set?.price !== undefined
                );
                if (priceOps.length > 0) {
                    const bulkResult = await PriceOverride.bulkWrite(priceOps);
                    results.prices = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
                }
            }
            
            if (operation.blocked !== undefined) {
                const blockOps = operations.filter(o => 
                    o.deleteOne !== undefined || 
                    (o.updateOne && !o.updateOne.update?.$set?.price && !o.updateOne.update?.$set?.minStay)
                );
                if (blockOps.length > 0) {
                    const blockResult = await BlockedDate.bulkWrite(blockOps);
                    results.blocks = (blockResult.upsertedCount || 0) + (blockResult.deletedCount || 0);
                }
            }
            
            if (operation.minStay !== undefined || operation.maxStay !== undefined) {
                const stayOps = operations.filter(o => 
                    o.updateOne?.update?.$set?.minStay !== undefined ||
                    o.updateOne?.update?.$set?.maxStay !== undefined
                );
                if (stayOps.length > 0) {
                    const stayResult = await StayRule.bulkWrite(stayOps);
                    results.stays = (stayResult.upsertedCount || 0) + (stayResult.modifiedCount || 0);
                }
            }
        }
        
        res.json({
            success: true,
            message: `Updated ${results.prices} prices, ${results.blocks} blocks, ${results.stays} stay rules`,
            results
        });
    } catch (error) {
        console.error('[SERVER] Bulk update error:', error);
        res.status(500).json({ error: 'Failed to perform bulk update' });
    }
};

exports.getSmartPrice = async (req, res) => {
    try {
        const { listingId, date } = req.query;
        
        const listing = await Listing.findOne({ 
            _id: listingId, 
            owner: req.user._id 
        });
        
        if (!listing) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const smartPricing = new SmartPricingService(listingId);
        await smartPricing.initialize();
        
        const price = await smartPricing.calculateSmartPrice(new Date(date));
        
        res.json({ success: true, price });
    } catch (error) {
        console.error('[SERVER] Smart price error:', error);
        res.status(500).json({ error: 'Failed to calculate smart price' });
    }
};

exports.exportCalendar = async (req, res) => {
    try {
        const { listingId, startDate, endDate, format = 'csv' } = req.query;
        
        const exportService = new ExportService(listingId);
        
        if (format === 'csv') {
            const csv = await exportService.generateCSV(startDate, endDate);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=calendar-${listingId}-${startDate}.csv`);
            res.send(csv);
        } else if (format === 'ics') {
            const ics = await exportService.generateICS(startDate, endDate);
            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', `attachment; filename=calendar-${listingId}-${startDate}.ics`);
            res.send(ics);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export calendar' });
    }
};

// ============== SEASONAL RULES CONTROLLERS ==============

exports.getSeasonalRules = async (req, res) => {
    try {
        const { listingId } = req.params;
        const rules = await SeasonalRule.find({ listing: listingId });
        res.json({ success: true, rules });
    } catch (error) {
        console.error('Error fetching seasonal rules:', error);
        res.status(500).json({ error: 'Failed to fetch seasonal rules' });
    }
};

exports.createSeasonalRule = async (req, res) => {
    try {
        const { listingId } = req.params;
        const ruleData = req.body;
        
        const rule = new SeasonalRule({
            ...ruleData,
            listing: listingId
        });
        await rule.save();
        
        res.json({ success: true, rule });
    } catch (error) {
        console.error('Error creating seasonal rule:', error);
        res.status(500).json({ error: 'Failed to create seasonal rule' });
    }
};

exports.updateSeasonalRule = async (req, res) => {
    try {
        const { ruleId } = req.params;
        const updates = req.body;
        
        const rule = await SeasonalRule.findByIdAndUpdate(ruleId, updates, { new: true });
        res.json({ success: true, rule });
    } catch (error) {
        console.error('Error updating seasonal rule:', error);
        res.status(500).json({ error: 'Failed to update seasonal rule' });
    }
};

exports.deleteSeasonalRule = async (req, res) => {
    try {
        const { ruleId } = req.params;
        await SeasonalRule.findByIdAndDelete(ruleId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting seasonal rule:', error);
        res.status(500).json({ error: 'Failed to delete seasonal rule' });
    }
};