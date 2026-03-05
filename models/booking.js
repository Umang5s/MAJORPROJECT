// models/booking.js - Update the schema

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
    default: "pending", // Changed default to 'pending'
    enum: ["pending", "confirmed", "completed", "cancelled", "no-show", "expired"],
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
    default: false,
  },
  reviewWindowExpires: {
    type: Date,
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
  // New fields for pending booking system
  pendingExpiresAt: {
    type: Date,
    default: function() {
      // Pending bookings expire after 15 minutes
      return new Date(Date.now() + 15 * 60 * 1000);
    }
  },
  expirationNotified: {
    type: Boolean,
    default: false
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

// Virtual to check if pending booking is expired
bookingSchema.virtual('isPendingExpired').get(function() {
  return this.status === 'pending' && this.pendingExpiresAt && this.pendingExpiresAt < new Date();
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