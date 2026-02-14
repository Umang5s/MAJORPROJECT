const Booking = require("../models/booking");
const Listing = require("../models/listing");

async function checkAvailability(listingId, checkIn, checkOut, requestedRooms) {

  const overlappingBookings = await Booking.find({
    listing: listingId,
    status: { $in: ["booked", "pending"] },

    // DATE OVERLAP CONDITION
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) }
  });

  let reservedRooms = 0;
  overlappingBookings.forEach(b => {
    reservedRooms += b.roomsBooked || 1;
  });

  const listing = await Listing.findById(listingId);

  const availableRooms = listing.totalRooms - reservedRooms;

  return {
    available: availableRooms >= requestedRooms,
    availableRooms
  };
}

module.exports = checkAvailability;
