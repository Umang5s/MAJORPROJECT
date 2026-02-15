// routes/reviews.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const { validatereview, isLoggedIn, isReviewAuthor } = require("../middleware.js");
const reviewController = require("../controllers/reviews.js");

// Create review (logged-in, validated)
router.post("/", isLoggedIn, validatereview, wrapAsync(reviewController.createReview));

// Update review (only author can edit)
router.put("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(reviewController.updateReview));

// Delete review (author OR owner allowed - controller checks permissions)
router.delete("/:reviewId", isLoggedIn, wrapAsync(reviewController.destroyReview));

module.exports = router;
