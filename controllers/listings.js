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

// Render the new listing multi-step form
module.exports.renderNewListingForm = async (req, res) => {
  try {
    const { type } = req.query;
    
    // Get user's existing listings for the "copy from existing" feature
    const userListings = await Listing.find({ owner: req.user._id })
      .select('title location image category')
      .limit(20);
    
    // Check if user has any draft listings
    const existingDraft = await Listing.findOne({ 
      owner: req.user._id,
      status: 'draft'
    }).sort({ updatedAt: -1 });
    
    res.render('listings/new', {
      type: type || 'home',
      userListings,
      existingDraft
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/host/listings');
  }
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
    
    // Try geocoding using the full address
    const fullAddress = req.body.listing.location || 
      `${req.body.listing.addressLine1}, ${req.body.listing.city}, ${req.body.listing.state}, ${req.body.listing.country}`;
    
    if (fullAddress) {
      try {
        const geoResponse = await geocodingClient
          .forwardGeocode({
            query: fullAddress,
            limit: 1,
          })
          .send();

        if (geoResponse.body.features.length) {
          geometry = geoResponse.body.features[0].geometry;
        }
      } catch (geoError) {
        console.error('Geocoding failed:', geoError.message);
      }
    }

    // Create new listing with all form data
    const listingData = {
      ...req.body.listing,
      owner: req.user._id,
      geometry,
      status: 'published', // Set to published after completion
      
      // Handle multi-step form fields
      propertyType: req.body.listing.propertyType,
      guestAccess: req.body.listing.guestAccess,
      detailedPropertyType: req.body.listing.detailedPropertyType,
      placeType: req.body.listing.placeType,
      addressLine1: req.body.listing.addressLine1,
      addressLine2: req.body.listing.addressLine2,
      city: req.body.listing.city,
      state: req.body.listing.state,
      postalCode: req.body.listing.postalCode,
      instructions: req.body.listing.instructions,
      guests: req.body.listing.guests || 4,
      bedrooms: req.body.listing.bedrooms || 1,
      beds: req.body.listing.beds || 1,
      bathrooms: req.body.listing.bathrooms || 1,
      amenities: req.body.listing.amenities ? req.body.listing.amenities.split(',') : [],
      highlights: req.body.listing.highlights ? req.body.listing.highlights.split(',') : [],
      bookingType: req.body.listing.bookingType || 'approve',
      weekendPrice: req.body.listing.weekendPrice,
      discounts: req.body.listing.discounts ? req.body.listing.discounts.split(',') : [],
      safetyItems: req.body.listing.safetyItems ? req.body.listing.safetyItems.split(',') : [],
      isBusiness: req.body.listing.isBusiness === 'true' || req.body.listing.isBusiness === true
    };

    // Parse residential address if provided as JSON string
    if (req.body.listing.residentialAddress) {
      try {
        listingData.residentialAddress = JSON.parse(req.body.listing.residentialAddress);
      } catch (e) {
        console.error('Error parsing residential address:', e);
      }
    }

    const newListing = new Listing(listingData);

    // Handle main image
    if (req.file) {
      newListing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }

    await newListing.save();
    req.flash("success", "New listing created successfully!");
    res.redirect(`/listings/${newListing._id}`);
  } catch (e) {
    console.error('ERROR in createListing:', e);
    req.flash("error", "Failed to create listing: " + e.message);
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
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Update fields from request body
  Object.assign(listing, req.body.listing);

  // Handle location/geocoding
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

  // Handle image upload
  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };
  }

  // Handle array fields
  if (req.body.listing.amenities) {
    listing.amenities = req.body.listing.amenities.split(',').filter(Boolean);
  }
  if (req.body.listing.highlights) {
    listing.highlights = req.body.listing.highlights.split(',').filter(Boolean);
  }
  if (req.body.listing.discounts) {
    listing.discounts = req.body.listing.discounts.split(',').filter(Boolean);
  }
  if (req.body.listing.safetyItems) {
    listing.safetyItems = req.body.listing.safetyItems.split(',').filter(Boolean);
  }

  // Handle residential address
  if (req.body.listing.residentialAddress) {
    try {
      listing.residentialAddress = JSON.parse(req.body.listing.residentialAddress);
    } catch (e) {
      console.error('Error parsing residential address:', e);
    }
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
      { city: { $regex: q, $options: "i" } },
      { state: { $regex: q, $options: "i" } }
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

// Handle copy from existing listing
module.exports.copyListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    const sourceListing = await Listing.findById(id);
    if (!sourceListing || !sourceListing.owner.equals(req.user._id)) {
      req.flash('error', 'Listing not found');
      return res.redirect('/host/listings');
    }
    
    // Create a new listing with copied data
    const newListing = new Listing({
      ...sourceListing.toObject(),
      _id: undefined,
      title: `${sourceListing.title} (Copy)`,
      owner: req.user._id,
      status: 'draft',
      reviews: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newListing.save();
    req.flash('success', 'Listing created from template');
    res.redirect(`/listings/${newListing._id}/edit`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not create listing');
    res.redirect('/host/listings');
  }
};