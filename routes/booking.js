const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { isLoggedIn } = require('../middleware');

router.post('/book/:id', isLoggedIn, bookingController.createBooking);
router.get('/bookings/my', isLoggedIn, bookingController.viewMyBookings);
router.get('/bookings/received', isLoggedIn, bookingController.viewReceivedBookings);
// Cancel a booking
router.delete("/bookings/:id", isLoggedIn, bookingController.cancelBooking);

module.exports = router;
