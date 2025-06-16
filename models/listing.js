const mongoose = require("mongoose");
const Review = require("./review");
const User = require("./user");
const { listingSchema } = require("../schema");
const Schema = mongoose.Schema;

// Check if model already exists before defining
const Listing =
  mongoose.models.Listing ||
  mongoose.model(
    "Listing",
    new Schema({
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
        default: "General",
      },
      originalCategory: {
        type: String, // To preserve base category when switching to Trending
      },
      reviews: [
        {
          type: Schema.Types.ObjectId,
          ref: "Review",
        },
      ],
      owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
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
    })
  );

// Middleware remains the same
Listing.schema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

module.exports = Listing;
