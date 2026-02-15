// controllers/reviews.js
const Listing = require("../models/listing");
const Review = require("../models/review");

async function updateTrendingStatus(listing) {
  await listing.populate("reviews");

  const ratings = listing.reviews.map((r) => r.rating);

  // no reviews → never trending
  if (ratings.length === 0) {
    if (listing.category === "Trending") {
      listing.category = listing.originalCategory || "All";
      listing.originalCategory = undefined;
      await listing.save();
    }
    return;
  }

  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  // SHOULD BE TRENDING
  if (avgRating >= 4) {
    // set original only first time
    if (listing.category !== "Trending") {
      listing.originalCategory = listing.originalCategory || listing.category;
      listing.category = "Trending";
      await listing.save();
    }
  } else {
    // REMOVE FROM TRENDING
    if (listing.category === "Trending") {
      listing.category = listing.originalCategory || "All";
      listing.originalCategory = undefined;
      await listing.save();
    }
  }
}

module.exports.createReview = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate(
      "reviews owner",
    );
    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    // Prevent owner from reviewing their own listing
    if (listing.owner && req.user && listing.owner.equals(req.user._id)) {
      req.flash("error", "You cannot review your own listing.");
      return res.redirect(`/listings/${listing._id}`);
    }

    // Prevent duplicate review by same user
    const existing = await Review.findOne({
      listing: listing._id,
      author: req.user._id,
    });
    if (existing) {
      req.flash(
        "error",
        "You already reviewed this listing. You can edit it instead.",
      );
      return res.redirect(`/listings/${listing._id}`);
    }

    const newReview = new Review(req.body.review || {});
    newReview.author = req.user._id;
    newReview.listing = listing._id;
    await newReview.save();

    listing.reviews.push(newReview._id);
    await listing.save();

    // update trending status (optional)
    await updateTrendingStatus(listing);

    req.flash("success", "New review created!");
    res.redirect(`/listings/${listing._id}`);
  } catch (err) {
    console.error("createReview error:", err);
    req.flash("error", "Could not create review. Try again.");
    res.redirect(`/listings/${req.params.id}`);
  }
};

module.exports.updateReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { rating, comment } = req.body.review || {};

    const review = await Review.findById(reviewId);
    if (!review) {
      req.flash("error", "Review not found.");
      return res.redirect(`/listings/${id}`);
    }

    // Only author may edit
    if (!review.author.equals(req.user._id)) {
      req.flash("error", "You are not allowed to edit this review.");
      return res.redirect(`/listings/${id}`);
    }

    review.rating = Number(rating) || review.rating;
    review.comment = (comment || review.comment).trim();
    await review.save();

    // Update listing trending if needed
    const listing = await Listing.findById(id).populate("reviews");
    if (listing) await updateTrendingStatus(listing);

    req.flash("success", "Review updated.");
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("updateReview error:", err);
    req.flash("error", "Could not update review.");
    res.redirect(`/listings/${req.params.id}`);
  }
};

module.exports.destroyReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const listing = await Listing.findById(id).populate("owner reviews");
    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      req.flash("error", "Review not found.");
      return res.redirect(`/listings/${id}`);
    }

    const isAuthor = req.user && review.author.equals(req.user._id);
    const isOwner =
      req.user && listing.owner && listing.owner.equals(req.user._id);

    if (!isAuthor && !isOwner) {
      req.flash("error", "You do not have permission to delete this review.");
      return res.redirect(`/listings/${id}`);
    }

    // remove review reference from listing
    listing.reviews = listing.reviews.filter((rId) => !rId.equals(review._id));
    await listing.save();

    await Review.findByIdAndDelete(review._id);

    // update trending status if necessary
    await updateTrendingStatus(listing);

    req.flash("success", "Review deleted.");
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("destroyReview error:", err);
    req.flash("error", "Could not delete review.");
    res.redirect(`/listings/${req.params.id}`);
  }
};
