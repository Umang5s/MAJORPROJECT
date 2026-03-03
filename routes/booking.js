const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { isLoggedIn } = require('../middleware');
const BlockedDate = require('../models/blockedDate');

// ============== BLOCKED DATES VALIDATION MIDDLEWARE ==============

async function validateDatesNotBlocked(req, res, next) {
    try {
        const { checkIn, checkOut } = req.body;
        const listingId = req.params.id;
        
        // Validate dates exist
        if (!checkIn || !checkOut) {
            req.flash("error", "Please select check-in and check-out dates.");
            return res.redirect(`/listings/${listingId}`);
        }
        
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        // Validate dates are valid
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
            req.flash("error", "Invalid date format.");
            return res.redirect(`/listings/${listingId}`);
        }
        
        // Check each date in the range
        let currentDate = new Date(checkInDate);
        const blockedDates = [];
        
        while (currentDate < checkOutDate) {
            const isBlocked = await BlockedDate.isDateBlocked(listingId, currentDate);
            if (isBlocked) {
                blockedDates.push(new Date(currentDate).toLocaleDateString());
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        if (blockedDates.length > 0) {
            req.flash('error', `The following dates are blocked and unavailable: ${blockedDates.join(', ')}`);
            return res.redirect(`/listings/${listingId}`);
        }
        
        // If no blocked dates, proceed to next middleware/controller
        next();
    } catch (error) {
        console.error('Error checking blocked dates:', error);
        req.flash('error', 'Error checking availability. Please try again.');
        res.redirect('back');
    }
}

// ============== BOOKING ROUTES ==============

// View routes
router.get('/bookings/my', isLoggedIn, bookingController.viewMyBookings);
router.get('/bookings/received', isLoggedIn, bookingController.viewReceivedBookings);

// Start booking process - with blocked dates validation
router.post("/bookings/start/:id", 
    isLoggedIn, 
    validateDatesNotBlocked, 
    bookingController.startBooking
);

// Checkout page
router.get("/bookings/checkout/:id", 
    isLoggedIn, 
    bookingController.createBookingRequest
);

// Confirm booking after payment - also validate again (in case dates were blocked while paying)
router.post("/bookings/confirm", 
    isLoggedIn, 
    bookingController.confirmBookingAfterPayment
);

// Cancel booking routes
router.post("/bookings/:id/cancel", 
    isLoggedIn, 
    bookingController.cancelBooking
);

router.get("/bookings/cancel/secure/:id/:token", 
    bookingController.secureCancelConfirmPage
);

router.post("/bookings/cancel/secure/:id/:token", 
    bookingController.secureCancelPerform
);

module.exports = router;