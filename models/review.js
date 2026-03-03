// models/review.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  
  // Review type
  reviewType: { 
    type: String, 
    enum: ['guest-to-host', 'host-to-guest'],
    required: true,
    default: 'guest-to-host'
  },
  
  // Overall rating (calculated average)
  overallRating: { type: Number, min: 1, max: 5, required: true },
  
  // Category ratings with their own comments
  cleanliness: {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' }
  },
  
  accuracy: {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' }
  },
  
  communication: {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' }
  },
  
  location: {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' }
  },
  
  checkIn: {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' }
  },
  
  value: {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' }
  },
  
  // Overall written review (optional)
  overallComment: { type: String, trim: true, default: '' },
  
  // Optional photos
  photos: [{
    url: String,
    filename: String
  }],
  
  // Host reply (for host to reply to guest)
  hostReply: {
    text: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
  },
  
  // Helpful votes
  helpfulVotes: {
    count: { type: Number, default: 0 },
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  
  // Publication status
  isPublished: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure one review per booking per type
reviewSchema.index({ booking: 1, reviewType: 1 }, { unique: true });

// Update updatedAt on save
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Review', reviewSchema);