const mongoose = require("mongoose");
const Review = require("./review");
const User = require("./user.js");
const { listingSchema } = require("../schema");
const schema = mongoose.Schema;

const listeningSchema = new schema({
    title: {
        type: String,
        required: true,
    },
    description: String,
    image:{
        url: String,
        filename: String
    },
    price: Number,
    location: String,
    country: String,
    reviews: [
        {
            type: schema.Types.ObjectId,
            ref: "Review"
        },
    ],
    owner: {
        type: schema.Types.ObjectId,
        ref: "User"
    },
    geometry: {
        type: {
            type: String, // Don't do `{ location: { type: String } }`
            enum: ['Point'], // 'location.type' must be 'Point'
            required: true
          },
          coordinates: {
            type: [Number],
            required: true
          }
    }
});

listeningSchema.post("findOneAndDelete", async (listing)=>{
    if(listing){
        await Review.deleteMany({ _id : { $in : listing.reviews}});
    }
});

const Listing = mongoose.model("Listing", listeningSchema);

module.exports = Listing;