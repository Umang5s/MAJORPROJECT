// utils/checkAvailability.js
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const utcDate = require("./utcDate");

async function checkAvailability(listingId, checkIn, checkOut, requestedRooms) {
  
  // Use UTC dates consistently
  const start = utcDate(checkIn);
  const end = utcDate(checkOut);
  
  // Validate dates
  if (!start || !end) {
    return { available: false, availableRooms: 0, error: "Invalid dates" };
  }

  // Prevent invalid range
  if (end <= start) {
    return { available: false, availableRooms: 0, error: "End date must be after start date" };
  }

  // Find all overlapping bookings
  const overlappingBookings = await Booking.find({
    listing: listingId,
    status: { $in: ["booked", "pending"] },
    
    // Proper overlap logic:
    // Booking overlaps if it starts before our end AND ends after our start
    $and: [
      { checkIn: { $lt: end } },
      { checkOut: { $gt: start } }
    ]
  });

  // Calculate total rooms already booked for this period
  let reservedRooms = 0;
  overlappingBookings.forEach(b => {
    reservedRooms += b.roomsBooked || 1;
  });

  const listing = await Listing.findById(listingId);
  const totalRooms = listing.totalRooms || 1;

  const availableRooms = Math.max(totalRooms - reservedRooms, 0);

  // Debug log
  console.log({
    listingId,
    checkIn: start.toISOString(),
    checkOut: end.toISOString(),
    requestedRooms,
    totalRooms,
    reservedRooms,
    availableRooms,
    overlappingBookings: overlappingBookings.length
  });

  return {
    available: requestedRooms <= availableRooms,
    availableRooms,
    totalRooms,
    reservedRooms
  };
}

module.exports = checkAvailability;