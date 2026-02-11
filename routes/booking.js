const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { isLoggedIn } = require('../middleware');

router.post('/book/:id', isLoggedIn, bookingController.createBookingRequest);
router.post('/bookings/confirm', isLoggedIn, bookingController.confirmBookingAfterPayment);
router.get('/bookings/my', isLoggedIn, bookingController.viewMyBookings);
router.get('/bookings/received', isLoggedIn, bookingController.viewReceivedBookings);
router.delete('/bookings/:id', isLoggedIn, bookingController.cancelBooking);


module.exports = router;