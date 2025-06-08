const express = require("express");
const router = express.Router();
const watchlistController = require("../controllers/watchlist");
const { isLoggedIn } = require("../middleware");

// Route to add a listing to a watchlist (create new or add to existing)
router.post("/add", isLoggedIn, watchlistController.addToWatchlist);

// Route to show all watchlists for the logged-in user
router.get("/", isLoggedIn, watchlistController.showUserWatchlists);

router.post("/remove/:listingId", isLoggedIn, watchlistController.removeListing);

router.delete(
  "/:listingId",
  isLoggedIn,
  watchlistController.removeListing
);

module.exports = router;
