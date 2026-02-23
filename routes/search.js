const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const checkAvailability = require("../utils/checkAvailability");
const Watchlist = require("../models/watchlist");

router.get("/results", async (req, res) => {

  const { location, checkIn, checkOut, guests } = req.query;

  if (!location) return res.redirect("/listings");

  const listings = await Listing.find({
    location: { $regex: location, $options: "i" }
  });

  const availableListings = [];

  for (const listing of listings) {
    const result = await checkAvailability(
      listing._id,
      checkIn,
      checkOut,
      guests || 1
    );

    if (result.available) {
      availableListings.push(listing);
    }
  }

  // ⭐ ADD THIS PART
  let watchlistListingIds = [];

  if (req.user) {
    const watchlist = await Watchlist.find({ user: req.user._id });
    watchlistListingIds = watchlist.map(w => w.listing.toString());
  }

  res.render("listings/index.ejs", {
    listings: availableListings,
    filters: req.query,
    watchlistListingIds
  });
});


module.exports = router;
