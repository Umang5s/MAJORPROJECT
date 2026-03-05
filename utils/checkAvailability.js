// utils/checkAvailability.js - Updated to consider pending bookings

const Booking = require("../models/booking");
const Listing = require("../models/listing");
const utcDate = require("./utcDate");

async function checkAvailability(listingId, checkIn, checkOut, requestedRooms) {
  
  const start = utcDate(checkIn);
  const end = utcDate(checkOut);
  
  if (!start || !end) {
    return { available: false, availableRooms: 0, error: "Invalid dates" };
  }

  if (end <= start) {
    return { available: false, availableRooms: 0, error: "End date must be after start date" };
  }

  // Find all CONFIRMED bookings (pending don't block unless they're within expiry window?)
  const confirmedBookings = await Booking.find({
    listing: listingId,
    status: { $in: ["confirmed", "completed"] },
    $and: [
      { checkIn: { $lt: end } },
      { checkOut: { $gt: start } }
    ]
  });

  // Find pending bookings that haven't expired yet
  const pendingBookings = await Booking.find({
    listing: listingId,
    status: "pending",
    pendingExpiresAt: { $gt: new Date() }, // Only consider non-expired pending
    $and: [
      { checkIn: { $lt: end } },
      { checkOut: { $gt: start } }
    ]
  });

  // Calculate total rooms reserved by confirmed bookings
  let reservedRooms = 0;
  confirmedBookings.forEach(b => {
    reservedRooms += b.roomsBooked || 1;
  });

  // Pending bookings also reserve rooms (but can expire)
  pendingBookings.forEach(b => {
    reservedRooms += b.roomsBooked || 1;
  });

  const listing = await Listing.findById(listingId);
  const totalRooms = listing.totalRooms || 1;

  const availableRooms = Math.max(totalRooms - reservedRooms, 0);

  return {
    available: requestedRooms <= availableRooms,
    availableRooms,
    totalRooms,
    reservedRooms,
    pendingCount: pendingBookings.length,
    confirmedCount: confirmedBookings.length
  };
}

module.exports = checkAvailability;