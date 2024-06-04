const express = require("express");
const router = express.Router({mergeParams: true});
const wrapAsync = require("../utils/wrapAsync.js");
const {validatereview, isLoggedIn, isReviewAuthor} = require("../middleware.js");

const reviewController = require("../controllers/reviews.js");

//review route
//posting
router.post("/",isLoggedIn,validatereview,wrapAsync(reviewController.createReview));

//review delete route
router.delete("/:reviewId",isLoggedIn,isReviewAuthor, wrapAsync(reviewController.destroyReview));


module.exports = router