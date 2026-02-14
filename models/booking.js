const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  checkIn: Date,
  checkOut: Date,
  price: Number,
  paymentId: String,
  status: {
    type: String,
    default: "booked",
    enum: ["booked", "cancelled"],
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
  roomsBooked: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
  },
  guestDetails: {
    name: String,
    email: String,
    phone: String,
    guestsCount: Number,
    arrivalTime: String,
    specialRequest: String,
  },
  cancelToken: {
    type: String,
  },

  cancelTokenExpires: {
    type: Date,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
