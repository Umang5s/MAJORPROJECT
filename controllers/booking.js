const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { sendEmail } = require("../utils/email");
const User = require("../models/user");
const checkAvailability = require("../utils/checkAvailability");
const crypto = require("crypto");
const razorpay = require("../utils/razorpay");

module.exports.createBookingRequest = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate("owner");
    const { checkIn, checkOut, roomsBooked } = req.session.bookingData;

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

    const totalPrice =
      totalNights * listing.price * (parseInt(roomsBooked, 10) || 1);

    // Create Razorpay Order
    const options = {
      amount: totalPrice * 100,
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);

    // pass roomsBooked to view as well
    res.render("bookings/checkout", {
      order,
      listing,
      checkIn,
      checkOut,
      roomsBooked,
      totalPrice,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Could not create payment order.");
    res.redirect("/listings");
  }
};

// module.exports.confirmBookingAfterPayment = async (req, res) => {
//   try {
//     // prefer razorpay fields (handler from popup) but accept legacy names too
//     const {
//       order_id,
//       payment_id, // legacy (if present)
//       // razorpay fields the popup returns
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       listing_id,
//       checkIn,
//       checkOut,
//       price,
//       guestDetails = {},
//       roomsBooked: roomsBookedFromBody,
//     } = req.body;

//     // fetch booking session (your flow stores bookingData in session)
//     const bookingSession = req.session.bookingData || {};
//     const sessionRooms = bookingSession.roomsBooked;

//     // determine roomsBooked (session preferred)
//     const roomsBooked = parseInt(sessionRooms || roomsBookedFromBody || 1, 10);

//     const listing = await Listing.findById(listing_id).populate("owner");
//     if (!listing) {
//       req.flash("error", "Listing not found.");
//       return res.redirect("/listings");
//     }

//     const inDate = new Date(checkIn);
//     const outDate = new Date(checkOut);
//     inDate.setHours(0, 0, 0, 0);
//     outDate.setHours(0, 0, 0, 0);

//     let nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
//     if (nights < 1) nights = 1;

//     // multiply by roomsBooked
//     const finalPrice = nights * listing.price * roomsBooked;

//     // determine actual payment id (prefer razorpay field)
//     // Razorpay sometimes sends array -> normalize to string
//     let actualPaymentId =
//       razorpay_payment_id ||
//       payment_id ||
//       req.body.payment_id ||
//       req.body.razorpay_payment_id;

//     // if array take last value
//     if (Array.isArray(actualPaymentId)) {
//       actualPaymentId = actualPaymentId.filter(Boolean).pop();
//     }

//     // OPTIONAL: signature verification (recommended)
//     // if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
//     //   const generated = crypto
//     //     .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//     //     .update(razorpay_order_id + "|" + razorpay_payment_id)
//     //     .digest("hex");
//     //   if (generated !== razorpay_signature) {
//     //     req.flash("error", "Payment verification failed");
//     //     return res.redirect("/listings");
//     //   }
//     // }

//     // Create booking document (include roomsBooked)
//     const booking = new Booking({
//       listing: listing._id,
//       guest: req.user._id,
//       host: listing.owner._id,
//       checkIn: new Date(checkIn),
//       checkOut: new Date(checkOut),
//       roomsBooked: roomsBooked,
//       price: finalPrice,
//       paymentId: actualPaymentId,
//       status: "booked",

//       guestDetails: {
//         name: guestDetails?.name,
//         email: guestDetails?.email,
//         phone: guestDetails?.phone,
//         guestsCount: guestDetails?.guestsCount,
//         arrivalTime: guestDetails?.arrivalTime,
//         specialRequest: guestDetails?.specialRequest,
//       },
//     });

//     const token = crypto.randomBytes(24).toString("hex");
//     const expiresAt = Date.now() + 1000 * 60 * 60 * 48;

//     booking.cancelToken = token;
//     booking.cancelTokenExpires = new Date(expiresAt);

//     await booking.save();

//     const baseUrl =
//       process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;

//     let cancelUrl = null;
//     if (booking.cancelToken) {
//       cancelUrl = `${baseUrl}/bookings/cancel/secure/${booking._id}/${booking.cancelToken}`;
//     }
//     // reload booking with populated guest & host and listing (safe)
//     const populatedBooking = await Booking.findById(booking._id)
//       .populate({ path: "guest", select: "email username" })
//       .populate({ path: "host", select: "email username" })
//       .populate({ path: "listing", select: "title" });

//     const guestEmail =
//       populatedBooking?.guestDetails?.email || populatedBooking?.guest?.email;
//     const hostEmail = populatedBooking?.host?.email;

//     // Safety: if missing, log and skip sending to that recipient
//     if (!guestEmail)
//       console.warn("No guest email available for booking", booking._id);
//     if (!hostEmail)
//       console.warn("No host email available for booking", booking._id);

//     // SEND EMAIL TO GUEST (if exists)
//     if (guestEmail) {
//       await sendEmail({
//         templateName: "bookingConfirmation",
//         to: guestEmail,
//         subject: "Your booking is confirmed!",
//         data: {
//           userName:
//             populatedBooking?.guestDetails?.name ||
//             populatedBooking?.guest?.username ||
//             populatedBooking?.guest?.email,

//           listingTitle: listing.title,
//           from: new Date(checkIn).toDateString(),
//           to: new Date(checkOut).toDateString(),
//           totalPrice: finalPrice,
//           roomsBooked: booking.roomsBooked,
//           bookingId: booking._id,
//           cancelUrl,
//           siteUrl: process.env.SITE_URL || "http://localhost:3000",
//         },
//       });
//     }

//     // SEND EMAIL TO HOST (OWNER)
//     if (hostEmail) {
//       await sendEmail({
//         templateName: "ownerNewBooking",
//         to: hostEmail,
//         subject: "You received a new booking!",
//         data: {
//           ownerName:
//             populatedBooking.host.username || populatedBooking.host.email,
//           listingTitle: listing.title,
//           from: new Date(checkIn).toDateString(),
//           to: new Date(checkOut).toDateString(),
//           totalPrice: finalPrice,
//           roomsBooked: booking.roomsBooked,
//           bookingId: booking._id,
//           siteUrl: process.env.SITE_URL || "http://localhost:3000",
//         },
//       });
//     }

//     req.flash("success", "Booking confirmed! Email sent.");
//     res.redirect("/bookings/my");
//   } catch (err) {
//     console.error(err);
//     req.flash("error", "Something went wrong saving your booking.");
//     res.redirect("/listings");
//   }
// };
module.exports.confirmBookingAfterPayment = async (req, res) => {
  try {
    // accept legacy & razorpay fields
    const {
      order_id,
      payment_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      listing_id,
      checkIn,
      checkOut,
      price,
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

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    inDate.setHours(0, 0, 0, 0);
    outDate.setHours(0, 0, 0, 0);

    let nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    if (nights < 1) nights = 1;

    const finalPrice = nights * listing.price * roomsBooked;

    // normalize payment id
    let actualPaymentId =
      razorpay_payment_id ||
      payment_id ||
      req.body.payment_id ||
      req.body.razorpay_payment_id;

    if (Array.isArray(actualPaymentId)) {
      actualPaymentId = actualPaymentId.filter(Boolean).pop();
    }

    // create booking object (don't save yet)
    const booking = new Booking({
      listing: listing._id,
      guest: req.user._id,
      host: listing.owner._id,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      roomsBooked: roomsBooked,
      price: finalPrice,
      paymentId: actualPaymentId,
      status: "booked",
      guestDetails: {
        name: guestDetails?.name,
        email: guestDetails?.email,
        phone: guestDetails?.phone,
        guestsCount: guestDetails?.guestsCount,
        arrivalTime: guestDetails?.arrivalTime,
        specialRequest: guestDetails?.specialRequest,
      },
    });

    // --- generate cancel token BEFORE save so email always has it ---
    try {
      const token = crypto.randomBytes(24).toString("hex");
      booking.cancelToken = token;
      booking.cancelTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48 hours
    } catch (tokenErr) {
      console.error("Error generating cancel token:", tokenErr);
      // continue, booking will be saved without cancel token (email won't have link)
    }

    // save once
    await booking.save();

    // clear session bookingData (avoid duplicates)
    req.session.bookingData = null;

    // reload booking for sending emails
    const populatedBooking = await Booking.findById(booking._id)
      .populate({ path: "guest", select: "email username" })
      .populate({ path: "host", select: "email username" })
      .populate({ path: "listing", select: "title" });

    const guestEmail =
      populatedBooking?.guestDetails?.email || populatedBooking?.guest?.email;
    const hostEmail = populatedBooking?.host?.email;

    // build baseUrl robustly (works on localhost & production)
    const baseUrl =
      process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;

    let cancelUrl = null;
    if (booking.cancelToken) {
      cancelUrl = `${baseUrl}/bookings/cancel/secure/${booking._id}/${booking.cancelToken}`;
    }

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
            populatedBooking?.guestDetails?.name ||
            populatedBooking?.guest?.username ||
            populatedBooking?.guest?.email,
          listingTitle: listing.title,
          from: new Date(checkIn).toDateString(),
          to: new Date(checkOut).toDateString(),
          totalPrice: finalPrice,
          roomsBooked: booking.roomsBooked,
          bookingId: booking._id,
          cancelUrl,
          siteUrl: baseUrl,
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
          roomsBooked: booking.roomsBooked,
          bookingId: booking._id,
          siteUrl: baseUrl,
        },
      });
    }

    req.flash("success", "Booking confirmed! Email sent.");
    res.redirect("/bookings/my");
  } catch (err) {
    console.error("confirmBookingAfterPayment error:", err);
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
        to: booking.guestDetails?.email || booking.guest.email,
        subject: "Your booking has been cancelled",
        data: {
          userName:
            booking.guestDetails?.name ||
            booking.guest.username ||
            booking.guest.email,
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
        to: booking.guestDetails?.email || booking.guest.email,
        subject: "Host cancelled your booking",
        data: {
          userName:
            booking.guestDetails?.name ||
            booking.guest.username ||
            booking.guest.email,
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

module.exports.startBooking = async (req, res) => {
  const { checkIn, checkOut, roomsBooked } = req.body;
  const listingId = req.params.id;

  const result = await checkAvailability(
    listingId,
    checkIn,
    checkOut,
    parseInt(roomsBooked),
  );

  if (!result.available) {
    req.flash(
      "error",
      `Only ${result.availableRooms} rooms available for selected dates`,
    );
    return res.redirect(`/listings/${listingId}`);
  }

  // store in session
  req.session.bookingData = {
    listingId,
    checkIn,
    checkOut,
    roomsBooked,
  };

  res.redirect(`/bookings/checkout/${listingId}`);
};

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

    // already cancelled => show friendly message
    if (booking.status === "cancelled") {
      req.flash("info", "Booking already cancelled.");
      return res.redirect("/bookings/my");
    }

    // token must exist and match and not be expired
    if (!booking.cancelToken || booking.cancelToken !== token) {
      req.flash("error", "Invalid or tampered cancel link.");
      return res.redirect("/listings");
    }
    if (booking.cancelTokenExpires && booking.cancelTokenExpires < Date.now()) {
      req.flash("error", "Cancel link expired.");
      return res.redirect("/listings");
    }

    // render a confirmation page (user must click to cancel)
    return res.render("emails/cancelConfirm", { booking });
  } catch (err) {
    console.error("secureCancelConfirmPage error:", err);
    req.flash("error", "Unable to verify cancel link. Try again.");
    return res.redirect("/listings");
  }
};

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

    // If already cancelled, idempotent result
    if (booking.status === "cancelled") {
      req.flash("info", "Booking already cancelled.");
      return res.redirect("/bookings/my");
    }

    // token validation
    if (!booking.cancelToken || booking.cancelToken !== token) {
      req.flash("error", "Invalid or tampered cancel link.");
      return res.redirect("/listings");
    }
    if (booking.cancelTokenExpires && booking.cancelTokenExpires < Date.now()) {
      req.flash("error", "Cancel link expired.");
      return res.redirect("/listings");
    }

    // perform cancellation: clear token BEFORE side-effects to make it single-use
    booking.cancelToken = undefined;
    booking.cancelTokenExpires = undefined;
    booking.status = "cancelled";
    await booking.save();

    // Notify guest & host by email (uses your existing templates)
    const guestEmail = booking.guestDetails?.email || booking.guest?.email;
    const hostEmail = booking.host?.email;

    if (guestEmail) {
      await sendEmail({
        templateName: "cancellation",
        to: guestEmail,
        subject: `Your booking ${booking._id} has been cancelled`,
        data: {
          userName:
            booking.guestDetails?.name || booking.guest?.username || guestEmail,
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl:
            process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
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
          siteUrl:
            process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
        },
      });
    }

    // show confirmation page after successful cancel
    req.flash("success", "Booking cancelled successfully.(Email sent!)");

    return res.redirect("/bookings/my");
  } catch (err) {
    console.error("secureCancelPerform error:", err);
    req.flash(
      "error",
      "Unable to cancel booking. Try again or contact support.",
    );
    return res.redirect("/listings");
  }
};
