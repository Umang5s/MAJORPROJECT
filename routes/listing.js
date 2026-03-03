const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner, validateListing, trackUniqueView } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// Search route - searches ALL listings
router.get("/search", wrapAsync(listingController.searchListings));

// In routes/listings.js - update the POST route
router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.array("listing[images]", 10), // Changed from single to array
    validateListing,
    wrapAsync(listingController.createListing)
  );

// New listing page (multi-step form)
router.get("/new", isLoggedIn, wrapAsync(listingController.renderNewListingForm));

// Copy from existing listing
router.get("/copy/:id", isLoggedIn, wrapAsync(listingController.copyListing));

router.get(
  "/:id/analytics",
  isLoggedIn,
  trackUniqueView, // Still track the view
  wrapAsync(listingController.getListingAnalytics)
);


router.get(
  "/analytics/dashboard",
  isLoggedIn,
  wrapAsync(listingController.getHostDashboardAnalytics)
);

router.get(
  "/:id/export",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.exportViewData)
);

// In routes/listings.js - update the PUT route for editing
router
  .route("/:id")
  .get(trackUniqueView, wrapAsync(listingController.showListings))
  .put(
    isLoggedIn,
    isOwner,
    upload.array("listing[photos]", 10), // Changed to array
    validateListing,
    wrapAsync(listingController.editListing)
  )
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

// Edit routes
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));
router.put("/:id", isLoggedIn, isOwner, upload.array("listing[photos]", 10), wrapAsync(listingController.updateListing));


module.exports = router;