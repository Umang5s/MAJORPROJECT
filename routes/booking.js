const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { isLoggedIn } = require('../middleware');

router.get('/bookings/my', isLoggedIn, bookingController.viewMyBookings);
router.get('/bookings/received', isLoggedIn, bookingController.viewReceivedBookings);
router.post("/bookings/start/:id", isLoggedIn, bookingController.startBooking);
router.get("/bookings/checkout/:id", isLoggedIn, bookingController.createBookingRequest);
router.post("/bookings/confirm", isLoggedIn, bookingController.confirmBookingAfterPayment);
router.post("/bookings/:id/cancel", isLoggedIn, bookingController.cancelBooking);
router.get("/bookings/cancel/secure/:id/:token", bookingController.secureCancelConfirmPage);
router.post("/bookings/cancel/secure/:id/:token", bookingController.secureCancelPerform);

module.exports = router;