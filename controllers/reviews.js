const Listing = require("../models/listing");
const Review = require("../models/review");

async function updateTrendingStatus(listing) {
    await listing.populate("reviews");
    const ratings = listing.reviews.map(r => r.rating);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    if (avgRating >= 4 && listing.category !== "Trending") {
        listing.originalCategory = listing.category;
        listing.category = "Trending";
    } else if (avgRating < 4 && listing.category === "Trending") {
        listing.category = listing.originalCategory || "All";
        listing.originalCategory = undefined;
    }
    await listing.save();
}

module.exports.createReview = async (req, res) => {
    const listing = await Listing.findById(req.params.id).populate("reviews");
    const newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    newReview.listing = listing._id;
    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();

    await updateTrendingStatus(listing);

    req.flash("success", "New review created!");
    res.redirect(`/listings/${listing._id}`);
};


module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "review deleted!");
  res.redirect(`/listings/${id}`);
};
