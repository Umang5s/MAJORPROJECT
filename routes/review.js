// routes/reviewRoutes.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  validateReview,
  validateReply,
  validateHostReview, // ← Add this
  canReviewBooking,
  canHostReviewGuest,
  canEditReview,
  canReplyToReview,
} = require("../middleware");
const reviewController = require("../controllers/reviews"); // Fixed: should be reviewController
const multer = require("multer");
const path = require("path");
const { storage } = require("../cloudConfig"); // If you have cloudinary setup
// const upload = multer({ dest: 'uploads/' }); // Simple disk storage

// Better: Use memory storage or cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// ========== GUEST REVIEW ROUTES ==========

// Show review form for guest
router.get(
  "/bookings/:bookingId/review",
  isLoggedIn,
  canReviewBooking,
  (req, res) => {
    res.render("reviews/create", {
      bookingId: req.params.bookingId,
      title: "Write a Review",
    });
  },
);

// Submit guest review
router.post(
  "/bookings/:bookingId/reviews",
  isLoggedIn,
  canReviewBooking,
  upload.array("reviewPhotos", 5), // Handle up to 5 photos
  validateReview, // Validate after multer
  wrapAsync(reviewController.createGuestReview),
);

// ========== HOST REVIEW ROUTES ==========

// Show review form for host
router.get(
  "/bookings/:bookingId/host-review",
  isLoggedIn,
  canHostReviewGuest,
  (req, res) => {
    res.render("reviews/hostReview", {
      bookingId: req.params.bookingId,
      title: "Review Your Guest",
    });
  },
);

// Submit host review
router.post(
  "/bookings/:bookingId/host-reviews",
  isLoggedIn,
  canHostReviewGuest,
  validateHostReview,
  wrapAsync(reviewController.createHostReview),
);

// ========== REVIEW MANAGEMENT ROUTES ==========

// Show edit review form
router.get(
  "/reviews/:reviewId/edit",
  isLoggedIn,
  canEditReview,
  wrapAsync(async (req, res) => {
    const Review = require("../models/review");
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      req.flash("error", "Review not found");
      return res.redirect("back");
    }
    res.render("reviews/edit", {
      review,
      title: "Edit Review",
    });
  }),
);

// Update review
router.put(
  "/reviews/:reviewId",
  isLoggedIn,
  canEditReview,
  validateReview,
  wrapAsync(reviewController.updateReview),
);

// Delete review
router.delete(
  "/reviews/:reviewId",
  isLoggedIn,
  wrapAsync(reviewController.deleteReview),
);

// ========== HOST REPLY ROUTES ==========

// Post reply to review
router.post(
  "/reviews/:reviewId/reply",
  isLoggedIn,
  canReplyToReview,
  validateReply,
  wrapAsync(reviewController.replyToReview),
);

// Edit reply
router.put(
  "/reviews/:reviewId/reply",
  isLoggedIn,
  canReplyToReview,
  validateReply,
  wrapAsync(reviewController.editReply),
);

// Delete reply
router.delete(
  "/reviews/:reviewId/reply",
  isLoggedIn,
  canReplyToReview,
  wrapAsync(reviewController.deleteReply),
);

module.exports = router;
