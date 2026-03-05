// controllers/booking.js
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { sendEmail } = require("../utils/email");
const User = require("../models/user");
const checkAvailability = require("../utils/checkAvailability");
const crypto = require("crypto");
const razorpay = require("../utils/razorpay");
const utcDate = require("../utils/utcDate");
const BookingService = require("../services/bookingService");

// ========== CREATE BOOKING REQUEST (CHECKOUT PAGE) ==========
module.exports.createBookingRequest = async (req, res) => {
  if (!req.session.bookingData) {
    req.flash("error", "Booking session expired. Please select dates again.");
    return res.redirect(`/listings/${req.params.id}`);
  }

  try {
    const listing = await Listing.findById(req.params.id).populate("owner");
    const { checkIn, checkOut, roomsBooked, totalPrice } = req.session.bookingData;

    // Check availability one more time
    const availability = await checkAvailability(
      listing._id,
      checkIn,
      checkOut,
      roomsBooked
    );

    if (!availability.available) {
      req.flash("error", `Sorry, only ${availability.availableRooms} rooms are now available.`);
      return res.redirect(`/listings/${listing._id}`);
    }

    // Check if there are pending bookings
    const pendingCount = await Booking.countDocuments({
      listing: listing._id,
      checkIn: utcDate(checkIn),
      checkOut: utcDate(checkOut),
      status: 'pending',
      pendingExpiresAt: { $gt: new Date() }
    });

    // Create Razorpay Order
    const options = {
      amount: totalPrice * 100,
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);

    // pass data to view
    res.render("bookings/checkout", {
      order,
      listing,
      checkIn,
      checkOut,
      roomsBooked,
      totalPrice,
      hasPending: pendingCount > 0,
      pendingCount
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Could not create payment order.");
    res.redirect("/listings");
  }
};

// ========== CONFIRM BOOKING AFTER PAYMENT ==========
module.exports.confirmBookingAfterPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      listing_id,
      checkIn,
      checkOut,
      guestDetails = {},
      roomsBooked: roomsBookedFromBody,
    } = req.body;

    // session booking data preferred
    const bookingSession = req.session.bookingData || {};
    const sessionRooms = bookingSession.roomsBooked;
    const roomsBooked = parseInt(sessionRooms || roomsBookedFromBody || 1, 10);

    const listing = await Listing.findById(listing_id).populate("owner");
    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    if (!listing.owner) {
      req.flash("error", "Listing owner information is missing. Please contact support.");
      return res.redirect("/listings");
    }

    const inDate = utcDate(checkIn);
    const outDate = utcDate(checkOut);

    let nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    if (nights < 1) nights = 1;

    const finalPrice = nights * listing.price * roomsBooked;

    // normalize payment id
    let actualPaymentId = razorpay_payment_id || req.body.razorpay_payment_id;

    if (Array.isArray(actualPaymentId)) {
      actualPaymentId = actualPaymentId.filter(Boolean).pop();
    }

    // Prepare booking data
    const bookingData = {
      listing: listing._id,
      guest: req.user._id,
      host: listing.owner._id,
      checkIn: utcDate(checkIn),
      checkOut: utcDate(checkOut),
      roomsBooked: roomsBooked,
      price: finalPrice,
      paymentId: actualPaymentId || 'pending_payment',
      guestDetails: {
        name: guestDetails?.name,
        email: guestDetails?.email,
        phone: guestDetails?.phone,
        guestsCount: guestDetails?.guestsCount || 1,
        arrivalTime: guestDetails?.arrivalTime,
        specialRequest: guestDetails?.specialRequest,
      },
    };

    // generate cancel token
    try {
      const token = crypto.randomBytes(24).toString("hex");
      bookingData.cancelToken = token;
      bookingData.cancelTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48 hours
    } catch (tokenErr) {
      console.error("Error generating cancel token:", tokenErr);
    }

    // Create pending/confirmed booking using service
    const result = await BookingService.createPendingBooking(bookingData);

    if (!result.success) {
      req.flash("error", result.message);
      return res.redirect(`/listings/${listing._id}`);
    }

    // clear session bookingData
    req.session.bookingData = null;

    // Send appropriate message
    if (result.status === 'confirmed') {
      req.flash("success", "🎉 Booking confirmed! Check your email for details.");
    } else {
      req.flash("success", "⏳ Your booking is pending confirmation. You'll be notified within 15 minutes if confirmed.");
    }

    res.redirect("/bookings/my");
  } catch (err) {
    console.error("confirmBookingAfterPayment error:", err);
    req.flash("error", "Something went wrong saving your booking.");
    res.redirect("/listings");
  }
};

// ========== VIEW MY BOOKINGS (GUEST) ==========
module.exports.viewMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      guest: req.user._id,
      status: { $ne: "cancelled" },
    })
    .populate("listing")
    .sort({ createdAt: -1 });

    // Separate bookings by status
    const pendingBookings = bookings.filter(b => b.status === 'pending');
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const expiredBookings = bookings.filter(b => b.status === 'expired');

    // Check for expired pending bookings
    const now = new Date();
    for (let booking of pendingBookings) {
      if (booking.pendingExpiresAt && booking.pendingExpiresAt < now && !booking.expirationNotified) {
        booking.status = 'expired';
        await booking.save();
      }
    }

    res.render("bookings/myBookings", { 
      pendingBookings,
      confirmedBookings,
      completedBookings,
      expiredBookings,
      allBookings: bookings
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to fetch your bookings.");
    res.redirect("/listings");
  }
};

// ========== VIEW RECEIVED BOOKINGS (HOST) ==========
module.exports.viewReceivedBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      host: req.user._id,
      status: { $ne: "cancelled" },
    })
      .populate("listing")
      .populate("guest")
      .sort({ createdAt: -1 });

    const pendingBookings = bookings.filter(b => b.status === 'pending');
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    const completedBookings = bookings.filter(b => b.status === 'completed');

    res.render("bookings/receivedBookings", { 
      pendingBookings,
      confirmedBookings,
      completedBookings,
      allBookings: bookings
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to fetch received bookings.");
    res.redirect("/listings");
  }
};

// ========== START BOOKING PROCESS ==========
module.exports.startBooking = async (req, res) => {
  try {
    const { checkIn, checkOut, roomsBooked } = req.body;
    const listingId = req.params.id;

    console.log("Booking attempt:", {
      checkIn,
      checkOut,
      roomsBooked,
      listingId,
    });

    // ===== 1. CONVERT TO UTC DATES =====
    const inDate = utcDate(checkIn);
    const outDate = utcDate(checkOut);

    if (!inDate || !outDate || isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      req.flash("error", "Invalid date format received.");
      return res.redirect(`/listings/${listingId}`);
    }

    // ===== 2. BASIC RULES =====
    const today = utcDate(new Date().toISOString().split("T")[0]);

    if (inDate < today) {
      req.flash("error", "You cannot book past dates.");
      return res.redirect(`/listings/${listingId}`);
    }

    const nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    if (nights < 1) {
      req.flash("error", "Check-out date must be after check-in date.");
      return res.redirect(`/listings/${listingId}`);
    }

    // ===== 3. ROOM VALIDATION =====
    const rooms = parseInt(roomsBooked, 10);
    if (!rooms || rooms < 1) {
      req.flash("error", "Please enter a valid number of rooms (minimum 1).");
      return res.redirect(`/listings/${listingId}`);
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    const maxRooms = listing.totalRooms || 1;
    if (rooms > maxRooms) {
      req.flash("error", `Maximum ${maxRooms} rooms available for this property.`);
      return res.redirect(`/listings/${listingId}`);
    }

    // ===== 4. AVAILABILITY CHECK =====
    const availability = await checkAvailability(listingId, checkIn, checkOut, rooms);

    if (!availability.available) {
      // Check if there are pending bookings that might expire
      const pendingCount = await Booking.countDocuments({
        listing: listingId,
        checkIn: inDate,
        checkOut: outDate,
        status: 'pending',
        pendingExpiresAt: { $gt: new Date() }
      });

      if (pendingCount > 0) {
        req.flash("info", 
          `⚠️ All rooms are currently pending. You can still proceed - if someone cancels or their booking expires within 15 minutes, yours will be confirmed automatically.`
        );
      } else {
        req.flash("error",
          `Only ${availability.availableRooms} room${availability.availableRooms !== 1 ? "s" : ""} available. You requested ${rooms}.`
        );
        return res.redirect(`/listings/${listingId}`);
      }
    }

    // ===== 5. CALCULATE TOTAL PRICE =====
    const totalPrice = nights * listing.price * rooms;

    // ===== 6. STORE IN SESSION =====
    req.session.bookingData = {
      listingId,
      checkIn,
      checkOut,
      roomsBooked: rooms,
      totalPrice,
      nights
    };

    console.log("Booking data stored in session:", req.session.bookingData);

    res.redirect(`/bookings/checkout/${listingId}`);
  } catch (err) {
    console.error("startBooking error:", err);
    req.flash("error", "Something went wrong while checking booking. Please try again.");
    res.redirect("/listings");
  }
};

// ========== CANCEL BOOKING ==========
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

    if (!isGuest && !isHost) {
      req.flash("error", "You do not have permission to cancel this booking.");
      return res.redirect("/listings");
    }

    // Use booking service to handle cancellation and auto-confirmation
    const result = await BookingService.cancelBooking(id, isGuest ? 'guest' : 'host');

    if (!result.success) {
      req.flash("error", "Error cancelling booking.");
      return res.redirect("/bookings/my");
    }

    // Send emails based on who cancelled
    if (isGuest) {
      await sendEmail({
        templateName: "cancellation",
        to: booking.guestDetails?.email || booking.guest.email,
        subject: "Your booking has been cancelled",
        data: {
          userName: booking.guestDetails?.name || booking.guest.username || booking.guest.email,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });

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

      req.flash("success", "✅ Booking cancelled successfully. If rooms become available, the next person in queue will be confirmed.");
      return res.redirect("/bookings/my");
    }

    if (isHost) {
      await sendEmail({
        templateName: "hostCancelled",
        to: booking.guestDetails?.email || booking.guest.email,
        subject: "Host cancelled your booking",
        data: {
          userName: booking.guestDetails?.name || booking.guest.username || booking.guest.email,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || "http://localhost:3000",
        },
      });

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

      req.flash("success", "✅ Booking cancelled. The next person in queue will be confirmed automatically.");
      return res.redirect("/bookings/received");
    }
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while cancelling.");
    res.redirect("/listings");
  }
};

// ========== SECURE CANCEL CONFIRMATION PAGE ==========
module.exports.secureCancelConfirmPage = async (req, res) => {
  const { id, token } = req.params;
  try {
    const booking = await Booking.findById(id)
      .populate("listing")
      .populate("guest")
      .populate("host");

    if (!booking) {
      req.flash("error", "Invalid booking link.");
      return res.redirect("/listings");
    }

    if (booking.status === "cancelled") {
      req.flash("info", "Booking already cancelled.");
      return res.redirect("/bookings/my");
    }

    if (!booking.cancelToken || booking.cancelToken !== token) {
      req.flash("error", "Invalid or tampered cancel link.");
      return res.redirect("/listings");
    }
    if (booking.cancelTokenExpires && booking.cancelTokenExpires < Date.now()) {
      req.flash("error", "Cancel link expired.");
      return res.redirect("/listings");
    }

    return res.render("emails/cancelConfirm", { booking });
  } catch (err) {
    console.error("secureCancelConfirmPage error:", err);
    req.flash("error", "Unable to verify cancel link. Try again.");
    return res.redirect("/listings");
  }
};

// ========== SECURE CANCEL PERFORM ==========
module.exports.secureCancelPerform = async (req, res) => {
  const { id, token } = req.params;
  try {
    const booking = await Booking.findById(id)
      .populate("listing")
      .populate("guest")
      .populate("host");

    if (!booking) {
      req.flash("error", "Invalid booking.");
      return res.redirect("/listings");
    }

    if (booking.status === "cancelled") {
      req.flash("info", "Booking already cancelled.");
      return res.redirect("/bookings/my");
    }

    if (!booking.cancelToken || booking.cancelToken !== token) {
      req.flash("error", "Invalid or tampered cancel link.");
      return res.redirect("/listings");
    }
    if (booking.cancelTokenExpires && booking.cancelTokenExpires < Date.now()) {
      req.flash("error", "Cancel link expired.");
      return res.redirect("/listings");
    }

    // Store listing info before cancelling
    const listingId = booking.listing._id;
    const checkIn = booking.checkIn;
    const checkOut = booking.checkOut;
    const roomsBooked = booking.roomsBooked;

    // Cancel the booking
    booking.cancelToken = undefined;
    booking.cancelTokenExpires = undefined;
    booking.status = "cancelled";
    await booking.save();

    // Try to confirm next pending booking
    await BookingService.tryConfirmNextPendingBooking(
      listingId,
      checkIn,
      checkOut,
      roomsBooked
    );

    // Notify guest & host
    const guestEmail = booking.guestDetails?.email || booking.guest?.email;
    const hostEmail = booking.host?.email;

    if (guestEmail) {
      await sendEmail({
        templateName: "cancellation",
        to: guestEmail,
        subject: `Your booking ${booking._id} has been cancelled`,
        data: {
          userName: booking.guestDetails?.name || booking.guest?.username || guestEmail,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
        },
      });
    }

    if (hostEmail) {
      await sendEmail({
        templateName: "ownerCancellation",
        to: hostEmail,
        subject: `Guest cancelled booking ${booking._id}`,
        data: {
          ownerName: booking.host?.username || hostEmail,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
        },
      });
    }

    req.flash("success", "✅ Booking cancelled successfully. Next person in queue has been notified.");

    return res.redirect("/bookings/my");
  } catch (err) {
    console.error("secureCancelPerform error:", err);
    req.flash("error", "Unable to cancel booking. Try again or contact support.");
    return res.redirect("/listings");
  }
};

// ========== CHECK BOOKING STATUS API ==========
module.exports.checkBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate("listing")
      .populate("guest");

    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // Check if user is authorized
    if (!booking.guest._id.equals(req.user._id) && !booking.host.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Calculate time remaining for pending booking
    let timeRemaining = null;
    if (booking.status === 'pending' && booking.pendingExpiresAt) {
      const now = new Date();
      const expiry = new Date(booking.pendingExpiresAt);
      const minutesRemaining = Math.max(0, Math.floor((expiry - now) / (1000 * 60)));
      const secondsRemaining = Math.max(0, Math.floor(((expiry - now) % (1000 * 60)) / 1000));
      
      if (minutesRemaining > 0 || secondsRemaining > 0) {
        timeRemaining = {
          minutes: minutesRemaining,
          seconds: secondsRemaining,
          total: (minutesRemaining * 60) + secondsRemaining
        };
      }
    }

    res.json({
      success: true,
      booking: {
        id: booking._id,
        status: booking.status,
        pendingExpiresAt: booking.pendingExpiresAt,
        timeRemaining,
        canReview: booking.canReview,
        isCompleted: booking.isCompleted
      }
    });
  } catch (err) {
    console.error("checkBookingStatus error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};