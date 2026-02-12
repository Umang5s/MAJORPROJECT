const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { sendEmail } = require("../utils/email");
const User = require("../models/user");

const razorpay = require("../utils/razorpay");

module.exports.createBookingRequest = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate("owner");
    const { checkIn, checkOut } = req.body;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    // remove time portion (VERY IMPORTANT)
    checkInDate.setHours(0, 0, 0, 0);
    checkOutDate.setHours(0, 0, 0, 0);
    // calculate nights properly
    let totalNights = Math.ceil(
      (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24),
    );

    // safety: minimum 1 night
    if (totalNights < 1) totalNights = 1;

    const totalPrice = totalNights * listing.price;

    // Create Razorpay Order
    const options = {
      amount: totalPrice * 100,
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);

    res.render("bookings/checkout", {
      order,
      listing,
      checkIn,
      checkOut,
      totalPrice,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Could not create payment order.");
    res.redirect("/listings");
  }
};

module.exports.confirmBookingAfterPayment = async (req, res) => {
  const { order_id, payment_id, listing_id, checkIn, checkOut, price } =
    req.body;

  try {
    const listing = await Listing.findById(listing_id).populate("owner");

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    inDate.setHours(0, 0, 0, 0);
    outDate.setHours(0, 0, 0, 0);

    let nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    if (nights < 1) nights = 1;

    const finalPrice = nights * listing.price;

    const booking = new Booking({
      listing: listing._id,
      guest: req.user._id,
      host: listing.owner._id,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      price: finalPrice,
      paymentId: payment_id,
      status: "booked",
    });

    await booking.save();

    // reload booking with populated guest & host and listing (safe)
    const populatedBooking = await Booking.findById(booking._id)
      .populate({ path: "guest", select: "email username" })
      .populate({ path: "host", select: "email username" })
      .populate({ path: "listing", select: "title" });

    const guestEmail = populatedBooking?.guest?.email;
    const hostEmail = populatedBooking?.host?.email;

    // Safety: if missing, log and skip sending to that recipient
    if (!guestEmail)
      console.warn("No guest email available for booking", booking._id);
    if (!hostEmail)
      console.warn("No host email available for booking", booking._id);

    // SEND EMAIL TO GUEST (if exists)
    if (guestEmail) {
      await sendEmail({
        templateName: "bookingConfirmation",
        to: guestEmail,
        subject: "Your booking is confirmed!",
        data: {
          userName:
            populatedBooking.guest.username || populatedBooking.guest.email,
          listingTitle: listing.title,
          from: new Date(checkIn).toDateString(),
          to: new Date(checkOut).toDateString(),
          totalPrice: finalPrice,
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });
    }

    // SEND EMAIL TO HOST (OWNER)
    if (hostEmail) {
      await sendEmail({
        templateName: "ownerNewBooking",
        to: hostEmail,
        subject: "You received a new booking!",
        data: {
          ownerName:
            populatedBooking.host.username || populatedBooking.host.email,
          listingTitle: listing.title,
          from: new Date(checkIn).toDateString(),
          to: new Date(checkOut).toDateString(),
          totalPrice: finalPrice,
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });
    }

    req.flash("success", "Booking confirmed! Email sent.");
    res.redirect("/bookings/my");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong saving your booking.");
    res.redirect("/listings");
  }
};

module.exports.viewMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      guest: req.user._id,
      status: { $ne: "cancelled" },
    }).populate("listing");
    res.render("bookings/myBookings", { bookings });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to fetch your bookings.");
    res.redirect("/");
  }
};

module.exports.viewReceivedBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      host: req.user._id,
      status: { $ne: "cancelled" },
    })
      .populate("listing")
      .populate("guest");
    res.render("bookings/receivedBookings", { bookings });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to fetch received bookings.");
    res.redirect("/");
  }
};

module.exports.cancelBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id)
      .populate("listing")
      .populate("guest")
      .populate("host");

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/my");
    }

    const isGuest = booking.guest._id.equals(req.user._id);
    const isHost = booking.host._id.equals(req.user._id);

    // Neither guest nor host
    if (!isGuest && !isHost) {
      req.flash("error", "You do not have permission to cancel this booking.");
      return res.redirect("/listings");
    }

    // Cancel booking
    booking.status = "cancelled";
    await booking.save();

    // ---------------- EMAIL LOGIC ----------------

    // If guest cancelled
    if (isGuest) {
      // Email to guest
      await sendEmail({
        templateName: "cancellation",
        to: booking.guest.email,
        subject: "Your booking has been cancelled",
        data: {
          userName: booking.guest.username || booking.guest.email,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });

      // Email to host
      await sendEmail({
        templateName: "ownerCancellation",
        to: booking.host.email,
        subject: "Guest cancelled the booking",
        data: {
          ownerName: booking.host.username || booking.host.email,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });

      req.flash("success", "Booking cancelled successfully.(Email sent!)");
      return res.redirect("/bookings/my");
    }

    // If host cancelled
    if (isHost) {
      // Email to guest
      await sendEmail({
        templateName: "hostCancelled",
        to: booking.guest.email,
        subject: "Host cancelled your booking",
        data: {
          userName: booking.guest.username || booking.guest.email,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });

      // Email to host
      await sendEmail({
        templateName: "ownerCancellation",
        to: booking.host.email,
        subject: "You cancelled a booking",
        data: {
          ownerName: booking.host.username || booking.host.email,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });

      req.flash("success", "Booking cancelled (guest notified).");
      return res.redirect("/bookings/received");
    }
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while cancelling.");
    res.redirect("/listings");
  }
};
