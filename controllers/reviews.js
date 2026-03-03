// controllers/reviewController.js
const Booking = require("../models/booking");
const Review = require("../models/review");
const Listing = require("../models/listing");
const {
  checkAndPublishReviews,
  updateListingAverages,
} = require("../services/reviewService");

/**
 * Create a guest review with category-specific comments
 */
module.exports.createGuestReview = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const {
      cleanliness,
      accuracy,
      communication,
      location,
      checkIn,
      value,
      overallComment,
    } = req.body.review;

    console.log("📝 Creating detailed review for booking:", bookingId);
    console.log("Review data received:", {
      cleanliness,
      accuracy,
      communication,
      location,
      checkIn,
      value,
      overallComment: overallComment || "(empty)",
    });

    // Validate that all ratings are present
    if (
      !cleanliness?.rating ||
      !accuracy?.rating ||
      !communication?.rating ||
      !location?.rating ||
      !checkIn?.rating ||
      !value?.rating
    ) {
      req.flash("error", "Please rate all categories");
      return res.redirect("back");
    }

    // Handle uploaded photos
    let photos = [];
    if (req.files && req.files.length > 0) {
      photos = req.files.map((file) => ({
        url: file.path || `/uploads/${file.filename}`,
        filename: file.filename,
      }));
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate("listing")
      .populate("guest")
      .populate("host");

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/bookings/my");
    }

    // Calculate overall rating (average of all category ratings)
    const overallRating =
      (parseFloat(cleanliness.rating) +
        parseFloat(accuracy.rating) +
        parseFloat(communication.rating) +
        parseFloat(location.rating) +
        parseFloat(checkIn.rating) +
        parseFloat(value.rating)) /
      6;

    // Create review with category-specific comments
    const review = new Review({
      listing: booking.listing._id,
      author: req.user._id,
      booking: booking._id,
      reviewType: "guest-to-host",

      cleanliness: {
        rating: parseFloat(cleanliness.rating),
        comment: cleanliness.comment || "",
      },

      accuracy: {
        rating: parseFloat(accuracy.rating),
        comment: accuracy.comment || "",
      },

      communication: {
        rating: parseFloat(communication.rating),
        comment: communication.comment || "",
      },

      location: {
        rating: parseFloat(location.rating),
        comment: location.comment || "",
      },

      checkIn: {
        rating: parseFloat(checkIn.rating),
        comment: checkIn.comment || "",
      },

      value: {
        rating: parseFloat(value.rating),
        comment: value.comment || "",
      },

      overallComment: overallComment || "",
      overallRating: Math.round(overallRating * 100) / 100,
      photos: photos,
      helpfulVotes: { count: 0, users: [] },
      isPublished: false,
    });

    console.log("💾 Saving detailed review:", review);

    await review.save();

    // IMPORTANT: Add the review to the listing's reviews array
    await Listing.findByIdAndUpdate(booking.listing._id, {
      $push: { reviews: review._id },
    });
    // Update booking
    booking.guestReviewed = true;
    await booking.save();

    // Check if both reviews are submitted
    await checkAndPublishReviews(booking._id);

    req.flash(
      "success",
      "Your detailed review has been submitted. It will be published after the host reviews or after 14 days.",
    );
    res.redirect("/bookings/my");
  } catch (error) {
    console.error("❌ Create review error:", error);

    if (error.name === "ValidationError") {
      console.error("Validation error details:", error.errors);
      req.flash(
        "error",
        "Validation failed: " +
          Object.values(error.errors)
            .map((e) => e.message)
            .join(", "),
      );
    } else {
      req.flash("error", "Failed to submit review. Please try again.");
    }

    res.redirect("back");
  }
};

/**
 * Create a host review (for host to review guest)
 */
module.exports.createHostReview = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { comment } = req.body.review;

    // Check for existing review
    const existingReview = await Review.findOne({
      booking: bookingId,
      reviewType: "host-to-guest",
    });
    if (existingReview) {
      req.flash("error", "You have already reviewed this guest");
      return res.redirect("/bookings/received");
    }

    // Find booking and validate
    const booking = await Booking.findById(bookingId)
      .populate("listing")
      .populate("guest")
      .populate("host");

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/bookings/received");
    }

    // Create host review with proper structure
    const reviewData = {
      listing: booking.listing._id,
      author: req.user._id,
      booking: booking._id,
      reviewType: "host-to-guest",
      // Use the nested structure for categories
      cleanliness: { rating: 5, comment: "" },
      accuracy: { rating: 5, comment: "" },
      communication: { rating: 5, comment: "" },
      location: { rating: 5, comment: "" },
      checkIn: { rating: 5, comment: "" },
      value: { rating: 5, comment: "" },
      overallRating: 5,
      comment: comment,
      isPublished: false,
    };

    const review = new Review(reviewData);
    await review.save();

    // Update booking
    booking.hostReviewed = true;
    await booking.save();

    // Check if both reviews are submitted to trigger publication
    await checkAndPublishReviews(booking._id);

    req.flash(
      "success",
      "Your review has been submitted. It will be published after the guest reviews or after 14 days.",
    );
    res.redirect("/bookings/received");
  } catch (error) {
    console.error("Create host review error:", error);
    req.flash("error", "Failed to submit review");
    res.redirect("back");
  }
};

/**
 * Update a review (only within 48 hours)
 */
module.exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const updates = req.body.review;

    const review = await Review.findById(reviewId).populate("booking");

    if (!review) {
      req.flash("error", "Review not found");
      return res.redirect("back");
    }

    // Update fields
    if (updates.cleanliness)
      review.cleanliness = parseFloat(updates.cleanliness);
    if (updates.accuracy) review.accuracy = parseFloat(updates.accuracy);
    if (updates.communication)
      review.communication = parseFloat(updates.communication);
    if (updates.location) review.location = parseFloat(updates.location);
    if (updates.checkIn) review.checkIn = parseFloat(updates.checkIn);
    if (updates.value) review.value = parseFloat(updates.value);
    if (updates.comment) review.comment = updates.comment;

    // Recalculate overall rating
    const overallRating =
      (review.cleanliness +
        review.accuracy +
        review.communication +
        review.location +
        review.checkIn +
        review.value) /
      6;
    review.overallRating = Math.round(overallRating * 100) / 100;

    review.updatedAt = new Date();
    await review.save();

    req.flash("success", "Review updated successfully");
    res.redirect("back");
  } catch (error) {
    console.error("Update review error:", error);
    req.flash("error", "Failed to update review");
    res.redirect("back");
  }
};

/**
 * Delete a review (author or host/owner)
 */
module.exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate("listing")
      .populate("booking");

    if (!review) {
      req.flash("error", "Review not found");
      return res.redirect("back");
    }

    // Store listing ID for updating averages
    const listingId = review.listing._id;

    // Delete the review
    await Review.findByIdAndDelete(reviewId);

    // Update booking review flags
    const booking = await Booking.findById(review.booking._id);
    if (review.reviewType === "guest-to-host") {
      booking.guestReviewed = false;
    } else {
      booking.hostReviewed = false;
    }
    await booking.save();

    // Update listing averages
    await updateListingAverages(listingId);

    req.flash("success", "Review deleted successfully");
    res.redirect("back");
  } catch (error) {
    console.error("Delete review error:", error);
    req.flash("error", "Failed to delete review");
    res.redirect("back");
  }
};

/**
 * Host reply to a review
 */
module.exports.replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { text } = req.body.reply;

    const review = await Review.findById(reviewId)
      .populate("listing")
      .populate("booking")
      .populate("author");

    if (!review) {
      req.flash("error", "Review not found");
      return res.redirect("back");
    }

    // Update or create host reply
    review.hostReply = {
      text,
      createdAt: review.hostReply?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await review.save();

    // Notify guest that host replied
    const booking = await Booking.findById(review.booking._id).populate(
      "guest",
    );
    if (booking.guest?.email) {
      await sendEmail({
        to: booking.guest.email,
        subject: `${booking.listing.title} host replied to your review`,
        template: "hostReplyNotification",
        context: {
          guestName: booking.guest.username || "Guest",
          listingTitle: booking.listing.title,
          replyText: text,
          listingUrl: `${process.env.SITE_URL || "http://localhost:3000"}/listings/${booking.listing._id}`,
        },
      });
    }

    req.flash("success", "Your reply has been posted");
    res.redirect("back");
  } catch (error) {
    console.error("Reply to review error:", error);
    req.flash("error", "Failed to post reply");
    res.redirect("back");
  }
};

/**
 * Edit host reply
 */
module.exports.editReply = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { text } = req.body.reply;

    const review = await Review.findById(reviewId);

    if (!review || !review.hostReply) {
      req.flash("error", "Reply not found");
      return res.redirect("back");
    }

    // Update reply
    review.hostReply.text = text;
    review.hostReply.updatedAt = new Date();
    await review.save();

    req.flash("success", "Reply updated");
    res.redirect("back");
  } catch (error) {
    console.error("Edit reply error:", error);
    req.flash("error", "Failed to edit reply");
    res.redirect("back");
  }
};

/**
 * Delete host reply
 */
module.exports.deleteReply = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review || !review.hostReply) {
      req.flash("error", "Reply not found");
      return res.redirect("back");
    }

    // Remove reply
    review.hostReply = undefined;
    await review.save();

    req.flash("success", "Reply deleted");
    res.redirect("back");
  } catch (error) {
    console.error("Delete reply error:", error);
    req.flash("error", "Failed to delete reply");
    res.redirect("back");
  }
};
