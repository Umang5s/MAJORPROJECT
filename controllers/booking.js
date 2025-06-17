const Booking = require('../models/booking');
const Listing = require('../models/listing');

const razorpay = require('../utils/razorpay');

module.exports.createBookingRequest = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('owner');
    const { checkIn, checkOut } = req.body;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkOutDate <= checkInDate) {
      req.flash('error', 'Check-out date must be after check-in date.');
      return res.redirect(`/listing/${req.params.id}`);
    }

    const totalNights = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);
    const totalPrice = totalNights * listing.price;

    // Create Razorpay Order
    const options = {
      amount: totalPrice * 100,
      currency: 'INR',
      receipt: `order_rcptid_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);

    res.render('bookings/checkout', {
      order,
      listing,
      checkIn,
      checkOut,
      totalPrice
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not create payment order.');
    res.redirect(`/listing/${req.params.id}`);
  }
};

module.exports.confirmBookingAfterPayment = async (req, res) => {
  const { order_id, payment_id, listing_id, checkIn, checkOut, price } = req.body;

  try {
    const listing = await Listing.findById(listing_id).populate('owner');

    const booking = new Booking({
      listing: listing._id,
      guest: req.user._id,
      host: listing.owner._id,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      price,
      paymentId: payment_id,
      status: 'booked'
    });

    await booking.save();
    req.flash('success', '✅ Booking confirmed!');
    res.redirect('/bookings/my');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong saving your booking.');
    res.redirect(`/listing/${listing_id}`);
  }
};

module.exports.viewMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ guest: req.user._id, status: { $ne: 'cancelled' } })
      .populate('listing');
    res.render('bookings/myBookings', { bookings });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to fetch your bookings.');
    res.redirect('/');
  }
};

module.exports.viewReceivedBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ host: req.user._id, status: { $ne: 'cancelled' } })
      .populate('listing')
      .populate('guest');
    res.render('bookings/receivedBookings', { bookings });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to fetch received bookings.');
    res.redirect('/');
  }
};

module.exports.cancelBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id);

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/my");
    }

    // Only the guest who booked can cancel
    if (!booking.guest.equals(req.user._id)) {
      req.flash("error", "You do not have permission to cancel this booking.");
      return res.redirect("/bookings/my");
    }

    // Update status instead of deleting
    booking.status = 'cancelled';
    await booking.save();

    req.flash("success", "Booking has been cancelled.");
    res.redirect("/bookings/my");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while cancelling.");
    res.redirect("/bookings/my");
  }
};
