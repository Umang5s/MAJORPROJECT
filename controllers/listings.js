const Listing = require("../models/listing");
const User = require("../models/user");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const Watchlist = require("../models/watchlist");
const Review = require("../models/review");

const geocodingClient = mbxGeocoding({ accessToken: mapToken });

async function calculateListingRatings(listings) {
  for (let listing of listings) {
    const reviews = await Review.find({ listing: listing._id });
    listing.reviewCount = reviews.length;

    if (reviews.length > 0) {
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0,
      );
      listing.avgRating = Number((totalRating / reviews.length).toFixed(1));
    } else {
      listing.avgRating = null;
    }
  }
  return listings;
}

// INDEX - Shows ALL listings (for traveller mode)
module.exports.index = async (req, res) => {
  const { category } = req.query;
  let filter = {};
  
  if (category === "Trending") {
    filter.category = "Trending";
  } else if (category && category !== "All") {
    filter.$or = [
      { category },
      { originalCategory: category, category: "Trending" },
    ];
  }
  
  // Get ALL listings (not filtered by owner)
  let listings = await Listing.find(filter);
  await calculateListingRatings(listings);

  // HARD FILTER FOR TRENDING (real rating based)
  if (category === "Trending") {
    listings = listings.filter((l) => l.avgRating !== null && l.avgRating >= 4);
  }

  let watchlistListingIds = [];
  if (req.user) {
    const watchlists = await Watchlist.find({ user: req.user._id });
    watchlistListingIds = watchlists.flatMap((wl) =>
      wl.listings.map((id) => id.toString()),
    );
  }

  res.render("listings/index.ejs", {
    listings,
    watchlistListingIds,
    user: req.user,
  });
};

// RENDER NEW FORM
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

// SHOW LISTING - Anyone can view any listing
module.exports.showListings = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author", select: "username _id" },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }

  let userReview = null;
  if (req.user) {
    userReview = listing.reviews.find(
      (r) => r.author && r.author._id && r.author._id.equals(req.user._id),
    );
  }

  res.render("listings/show.ejs", { listing, userReview });
};

// CREATE LISTING - Associates listing with logged in user (owner)
module.exports.createListing = async (req, res, next) => {
  try {
    let geometry = {
      type: "Point",
      coordinates: [72.5714, 23.0225] // Default coordinates
    };
    
    // Try geocoding
    try {
      const geoResponse = await geocodingClient
        .forwardGeocode({
          query: req.body.listing.location,
          limit: 1,
        })
        .send();

      if (geoResponse.body.features.length) {
        geometry = geoResponse.body.features[0].geometry;
      }
    } catch (geoError) {
      console.error('Geocoding failed:', geoError.message);
    }

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id; // Set the owner to current user

    if (req.file) {
      newListing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }

    newListing.geometry = geometry;

    await newListing.save();
    req.flash("success", "New listing created!");
    res.redirect("/listings");
  } catch (e) {
    console.error('ERROR in createListing:', e);
    req.flash("error", "Failed to create listing");
    res.redirect("/listings/new");
  }
};

// RENDER EDIT FORM - Only owner can access
module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }

  const originalImageUrl = listing.image?.url?.replace(
    "/upload",
    "/upload/w_250",
  );

  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

// EDIT LISTING - Only owner can update
module.exports.editListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if (req.body.listing.location) {
    try {
      const geoResponse = await geocodingClient
        .forwardGeocode({
          query: req.body.listing.location,
          limit: 1,
        })
        .send();

      if (geoResponse.body.features.length > 0) {
        listing.geometry = geoResponse.body.features[0].geometry;
      }
    } catch (geoError) {
      console.error('Geocoding failed:', geoError.message);
    }
  }

  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };
  }

  await listing.save();
  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
};

// DELETE LISTING - Only owner can delete
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};

// SEARCH LISTINGS - Searches ALL listings
module.exports.searchListings = async (req, res) => {
  const { q } = req.query;

  const listings = await Listing.find({
    $or: [
      { title: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
      { country: { $regex: q, $options: "i" } },
    ],
  });

  if (listings.length === 0) {
    req.flash("error", `No results found for "${q}"`);
    return res.redirect("/listings");
  }

  await calculateListingRatings(listings);

  let watchlistListingIds = [];
  if (req.user) {
    const watchlists = await Watchlist.find({ user: req.user._id });
    watchlistListingIds = watchlists.flatMap((wl) =>
      wl.listings.map((id) => id.toString()),
    );
  }

  res.render("listings/index.ejs", { listings, watchlistListingIds });
};