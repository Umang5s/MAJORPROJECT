const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    url: String,
    filename: String,
  },
  price: Number,
  location: String,
  country: String,
  category: {
    type: String,
    enum: ["Rooms", "Camping", "Farms", "Castles", "Amazing Pools", "General", "Trending"],
    default: "General",
  },
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
  // Status field - THIS IS KEY
  status: {
    type: String,
    enum: ["draft", "published"],
    default: "draft", // New listings start as draft
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
  },
  bedrooms: {
    type: Number,
    default: 1,
  },
  beds: {
    type: Number,
    default: 1,
  },
  bathrooms: {
    type: Number,
    default: 1,
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
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  views: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Virtual for isPublished
listingSchema.virtual('isPublished').get(function() {
  return this.status === 'published';
});

// Middleware to delete reviews when listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;