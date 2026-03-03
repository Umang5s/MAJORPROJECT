const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  // Change from single image to images array
  images: [{
    url: String,
    filename: String,
  }],
  // Keep backward compatibility (optional)
  image: {
    url: String,
    filename: String,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  location: String,
  country: String,
  category: {
    type: String,
    enum: ["Rooms", "Camping", "Farms", "Castles", "Amazing Pools", "General", "Trending"],
    default: "General",
  },
  originalCategory: String, // Store original category when moved to Trending
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
  },
  // Multi-step form fields
  propertyType: String,
  guestAccess: String,
  detailedPropertyType: String,
  placeType: String,
  addressLine1: String,
  addressLine2: String,
  city: String,
  state: String,
  postalCode: String,
  instructions: String,
  guests: {
    type: Number,
    default: 1,
    min: 1,
  },
  bedrooms: {
    type: Number,
    default: 1,
    min: 1,
  },
  beds: {
    type: Number,
    default: 1,
    min: 1,
  },
  bathrooms: {
    type: Number,
    default: 1,
    min: 1,
  },
  amenities: [String],
  highlights: [String],
  bookingType: {
    type: String,
    enum: ["approve", "instant"],
    default: "approve",
  },
  weekendPrice: Number,
  discounts: [String],
  safetyItems: [String],
  isBusiness: {
    type: Boolean,
    default: false,
  },
  residentialAddress: {
    country: String,
    flatNumber: String,
    street: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
  },
  // Total rooms available (for multi-room properties)
  totalRooms: {
    type: Number,
    default: 1,
    min: 1,
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  // SIMPLIFIED VIEW TRACKING - Only what you asked for
  uniqueViewers: [{
    type: String, // Store user ID or IP
  }],
  lastViewedAt: {
    type: Date,
    default:null,
  },
  // Aggregated rating fields
  avgRating: { type: Number, default: 0, min: 0, max: 5 },
  avgCleanliness: { type: Number, default: 0, min: 0, max: 5 },
  avgAccuracy: { type: Number, default: 0, min: 0, max: 5 },
  avgCommunication: { type: Number, default: 0, min: 0, max: 5 },
  avgLocation: { type: Number, default: 0, min: 0, max: 5 },
  avgCheckIn: { type: Number, default: 0, min: 0, max: 5 },
  avgValue: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  
  // For "Guest Favorite" badge calculation
  percentileRanking: { type: Number, default: 0 },
  isGuestFavorite: { type: Boolean, default: false },
  
  // Cache timestamp
  ratingsUpdatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Virtual for total unique viewers count
listingSchema.virtual('uniqueViewerCount').get(function() {
  return this.uniqueViewers?.length || 0;
});

// Virtual for cover image (first image)
listingSchema.virtual('coverImage').get(function() {
  if (this.images && this.images.length > 0) {
    return this.images[0].url;
  }
  // Fallback to old single image format
  if (this.image && this.image.url) {
    return this.image.url;
  }
  return '/images/default-listing.jpg';
});

// Virtual for isPublished
listingSchema.virtual('isPublished').get(function() {
  return this.status === 'published';
});

// Virtual for total photos count
listingSchema.virtual('photoCount').get(function() {
  if (this.images && this.images.length > 0) {
    return this.images.length;
  }
  if (this.image && this.image.url) {
    return 1;
  }
  return 0;
});

// Virtual to check if listing has enough reviews for Guest Favorite
listingSchema.virtual('hasEnoughReviews').get(function() {
  return this.reviewCount >= 5;
});

// Virtual to get the overall rating as a formatted string
listingSchema.virtual('formattedRating').get(function() {
  return this.avgRating ? this.avgRating.toFixed(1) : 'New';
});

// Method to check if a user can review this listing (based on completed bookings)
listingSchema.methods.canUserReview = async function(userId) {
  const Booking = mongoose.model('Booking');
  const completedBooking = await Booking.findOne({
    listing: this._id,
    guest: userId,
    status: 'completed',
    canReview: true,
    reviewWindowExpires: { $gt: new Date() }
  });
  return !!completedBooking;
};

// Static method to find trending listings (based on recent high ratings)
listingSchema.statics.findTrending = function(limit = 10) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return this.find({
    reviewCount: { $gte: 3 },
    avgRating: { $gte: 4.5 },
    updatedAt: { $gte: sixMonthsAgo },
    status: 'published'
  }).sort({ avgRating: -1, reviewCount: -1 }).limit(limit);
};

// Pre-save middleware to ensure price is set
listingSchema.pre('save', function(next) {
  if (this.price === undefined || this.price === null) {
    this.price = 0;
  }
  next();
});

// Middleware to delete reviews when listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

// Index for search and filtering
listingSchema.index({ category: 1, avgRating: -1, reviewCount: -1 });
listingSchema.index({ location: 'text', title: 'text', description: 'text' });
listingSchema.index({ geometry: '2dsphere' }); // For geospatial queries
listingSchema.index({ status: 1, createdAt: -1 });

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;