const Booking = require('../models/booking');
const Listing = require('../models/listing');

module.exports.createBooking = async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate('owner');
  const { checkIn, checkOut } = req.body;

  const totalNights = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24);
  const totalPrice = totalNights * listing.price;

  const booking = new Booking({
    listing: listing._id,
    guest: req.user._id,
    host: listing.owner._id,
    checkIn,
    checkOut,
    totalPrice
  });

  await booking.save();
  req.flash('success', 'Booking confirmed!');
  res.redirect('/bookings/my');
};

module.exports.viewMyBookings = async (req, res) => {
  const bookings = await Booking.find({ guest: req.user._id }).populate('listing');
  res.render('bookings/myBookings', { bookings });
};

module.exports.viewReceivedBookings = async (req, res) => {
  const bookings = await Booking.find({ host: req.user._id }).populate('listing').populate('guest');
  res.render('bookings/receivedBookings', { bookings });
};


module.exports.cancelBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id);

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/my");
    }

    // Check if current user is the guest who made the booking
    if (!booking.guest.equals(req.user._id)) {
      req.flash("error", "You do not have permission to cancel this booking.");
      return res.redirect("/bookings/my");
    }

    await Booking.findByIdAndDelete(id);

    req.flash("success", "Booking has been canceled.");
    res.redirect("/bookings/my");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong.");
    res.redirect("/bookings/my");
  }
};
