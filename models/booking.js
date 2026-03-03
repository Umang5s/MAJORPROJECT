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
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  paymentId: String,
  status: {
    type: String,
    default: "confirmed",
    enum: ["pending", "confirmed", "completed", "cancelled", "no-show"],
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
  // Review-related fields
  canReview: {
    type: Boolean,
    default: false, // Set to true after checkout
  },
  reviewWindowExpires: {
    type: Date, // 14 days after checkout
  },
  guestReviewed: {
    type: Boolean,
    default: false,
  },
  hostReviewed: {
    type: Boolean,
    default: false,
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
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Update the updatedAt field on save
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual to check if review window is still open
bookingSchema.virtual('isReviewWindowOpen').get(function() {
  return this.canReview && this.reviewWindowExpires && this.reviewWindowExpires > new Date();
});

// Virtual to check if booking is completed (past checkout)
bookingSchema.virtual('isCompleted').get(function() {
  return new Date(this.checkOut) < new Date() && this.status === 'confirmed';
});

module.exports = mongoose.model("Booking", bookingSchema);