const Listing = require("../models/listing");
const User = require("../models/user");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const Watchlist = require("../models/watchlist");
const Review = require("../models/review");
const { cloudinary } = require("../cloudConfig");

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
      populate: { 
        path: "author", 
        select: "username avatar" 
      }
    })
    .populate("owner");

    let watchlistListingIds = [];
  if (req.user) {
    const watchlists = await Watchlist.find({ user: req.user._id });
    watchlistListingIds = watchlists.flatMap((wl) =>
      wl.listings.map((id) => id.toString()),
    );
  }
  if (!listing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }

  // Calculate reviewCount if not present
  if (!listing.reviewCount) {
    listing.reviewCount = listing.reviews?.length || 0;
  }

  // Ensure images array exists (for backward compatibility)
  if (!listing.images && listing.image) {
    listing.images = [listing.image];
  }

  let userReview = null;
  if (req.user) {
    userReview = listing.reviews.find(
      (r) => r.author && r.author._id && r.author._id.equals(req.user._id),
    );
  }

  res.render("listings/show.ejs", { listing,watchlistListingIds, userReview });
};

// CREATE LISTING - Associates listing with logged in user (owner)
module.exports.createListing = async (req, res, next) => {
  try {
     console.log("=== CREATE LISTING DEBUG ===");
    console.log("Files received:", req.files ? req.files.length : 0);
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, i) => {
        console.log(`File ${i}:`, file.originalname, file.path, file.filename);
      });
    } else {
      console.log("No files received in req.files");
    }
    console.log("Body fields:", Object.keys(req.body.listing || {}));
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

    // Handle multiple image uploads - FIXED
    let images = [];
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} uploaded files`);
      images = req.files.map(file => ({
        url: file.path,
        filename: file.filename
      }));
    } else {
      console.log('No files uploaded - req.files is empty or undefined');
    }

    // Create new listing with all form data
    const listingData = {
      ...req.body.listing,
      owner: req.user._id,
      geometry,
      status: 'published',
      images: images,
      // Also set the first image as the main image for backward compatibility
      image: images.length > 0 ? images[0] : undefined,
      
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
      amenities: req.body.listing.amenities ? (Array.isArray(req.body.listing.amenities) ? req.body.listing.amenities : req.body.listing.amenities.split(',')) : [],
      highlights: req.body.listing.highlights ? (Array.isArray(req.body.listing.highlights) ? req.body.listing.highlights : req.body.listing.highlights.split(',')) : [],
      bookingType: req.body.listing.bookingType || 'approve',
      weekendPrice: req.body.listing.weekendPrice,
      weekendPremium: req.body.listing.weekendPremium || 2,
      discounts: req.body.listing.discounts ? (Array.isArray(req.body.listing.discounts) ? req.body.listing.discounts : req.body.listing.discounts.split(',')) : [],
      safetyItems: req.body.listing.safetyItems ? (Array.isArray(req.body.listing.safetyItems) ? req.body.listing.safetyItems : req.body.listing.safetyItems.split(',')) : [],
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
    await newListing.save();
    
    console.log('Listing created with images:', images.length);
    req.flash("success", "New listing created successfully!");
    res.redirect(`/host/listings`);
  } catch (e) {
    console.error('ERROR in createListing:', e);
    req.flash("error", "Failed to create listing: " + e.message);
    res.redirect("/listings/new");
  }
};

// DELETE LISTING - Only owner can delete
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  
  // Find the listing to get image filenames for Cloudinary cleanup
  const listing = await Listing.findById(id);
  
  if (listing) {
    // Delete all images from Cloudinary
    if (listing.images && listing.images.length > 0) {
      for (const image of listing.images) {
        if (image.filename) {
          await cloudinary.uploader.destroy(image.filename);
        }
      }
    }
    // Delete the main image if it exists and is different
    if (listing.image && listing.image.filename && 
        (!listing.images || !listing.images.some(img => img.filename === listing.image.filename))) {
      await cloudinary.uploader.destroy(listing.image.filename);
    }
  }
  
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing deleted!");
  res.redirect("/host/listings");
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

// RENDER EDIT FORM
module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    // Format photos properly - handle both images array and single image
    let photos = [];
    if (listing.images && listing.images.length > 0) {
        photos = listing.images.map(img => ({
            url: img.url,
            filename: img.filename,
            isExisting: true // Mark as existing photo
        }));
    } else if (listing.image && listing.image.url) {
        // Handle old single image format if it exists
        photos = [{
            url: listing.image.url,
            filename: listing.image.filename,
            isExisting: true
        }];
    }

    // Format the data for the Vue app
    const formData = {
        propertyType: listing.propertyType || "",
        guestAccess: listing.guestAccess || "",
        detailedPropertyType: listing.detailedPropertyType || "",
        placeType: listing.placeType || "",
        address: listing.location || "",
        country: listing.country || "India",
        lat: listing.geometry?.coordinates?.[1] || null,
        lng: listing.geometry?.coordinates?.[0] || null,
        addressLine1: listing.addressLine1 || "",
        addressLine2: listing.addressLine2 || "",
        city: listing.city || "",
        state: listing.state || "",
        postalCode: listing.postalCode || "",
        instructions: listing.instructions || "",
        fullAddress: listing.location || "",
        guests: listing.guests || 4,
        bedrooms: listing.bedrooms || 1,
        beds: listing.beds || 1,
        bathrooms: listing.bathrooms || 1,
        amenities: listing.amenities || [],
        photos: photos, // Use the properly formatted photos array
        title: listing.title || "",
        description: listing.description || "",
        highlights: listing.highlights || [],
        bookingType: listing.bookingType || "approve",
        basePrice: listing.price || 2273,
        weekendPrice: listing.weekendPrice || listing.price || 2273,
        weekendPremium: listing.weekendPremium || 2,
        discounts: listing.discounts || [],
        safetyItems: listing.safetyItems || [],
        residentialCountry: listing.residentialAddress?.country || "India",
        flatNumber: listing.residentialAddress?.flatNumber || "",
        residentialStreet: listing.residentialAddress?.street || "",
        landmark: listing.residentialAddress?.landmark || "",
        residentialCity: listing.residentialAddress?.city || "",
        residentialState: listing.residentialAddress?.state || "",
        residentialPincode: listing.residentialAddress?.pincode || "",
        isBusiness: listing.isBusiness ? "yes" : "no",
    };

    res.render("listings/edit", { 
        listing,
        formData: JSON.stringify(formData),
        existingDraft: null
    });
};

// UPDATE LISTING
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listingData = req.body.listing;

    // Find existing listing
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    // Handle photos
    let images = [];

    // Handle kept photos (existing ones that weren't deleted)
    if (listingData.keptPhotos) {
        try {
            const keptPhotos = JSON.parse(listingData.keptPhotos);
            images = [...keptPhotos];
        } catch (e) {
            console.error("Error parsing keptPhotos:", e);
        }
    }

    // Handle new photo uploads
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => ({
            url: file.path,
            filename: file.filename
        }));
        images = [...images, ...newImages];
    }

    // Handle photo deletions
    if (listingData.deletedPhotos) {
        try {
            const deletedPhotos = JSON.parse(listingData.deletedPhotos);
            
            // Delete from Cloudinary
            for (const photo of deletedPhotos) {
                if (photo.filename) {
                    await cloudinary.uploader.destroy(photo.filename);
                    console.log("Deleted from Cloudinary:", photo.filename);
                }
            }
        } catch (e) {
            console.error("Error parsing deletedPhotos:", e);
        }
    }

    // If no images at all, keep the existing ones
    if (images.length === 0 && listing.images && listing.images.length > 0) {
        images = listing.images;
    }

    // Parse residential address if provided
    let residentialAddress = listing.residentialAddress || {};
    if (listingData.residentialStreet || listingData.residentialCity) {
        residentialAddress = {
            country: listingData.residentialCountry || "India",
            flatNumber: listingData.flatNumber || "",
            street: listingData.residentialStreet || "",
            landmark: listingData.landmark || "",
            city: listingData.residentialCity || "",
            state: listingData.residentialState || "",
            pincode: listingData.residentialPincode || "",
        };
    }

    // Update listing with new data
    const updatedListing = await Listing.findByIdAndUpdate(id, {
        title: listingData.title,
        description: listingData.description,
        price: listingData.basePrice,
        weekendPrice: listingData.weekendPrice || listingData.basePrice,
        location: listingData.fullAddress || listingData.address || listing.location,
        country: listingData.country,
        category: determineCategory(listingData.propertyType || listingData.detailedPropertyType),
        totalRooms: listingData.bedrooms,
        propertyType: listingData.propertyType,
        guestAccess: listingData.guestAccess,
        detailedPropertyType: listingData.detailedPropertyType,
        placeType: listingData.placeType,
        addressLine1: listingData.addressLine1,
        addressLine2: listingData.addressLine2,
        city: listingData.city,
        state: listingData.state,
        postalCode: listingData.postalCode,
        instructions: listingData.instructions,
        guests: listingData.guests,
        bedrooms: listingData.bedrooms,
        beds: listingData.beds,
        bathrooms: listingData.bathrooms,
        amenities: listingData.amenities ? (Array.isArray(listingData.amenities) ? listingData.amenities : listingData.amenities.split(',')) : [],
        images: images,
        // Update the main image field for backward compatibility
        image: images.length > 0 ? images[0] : (listing.image || undefined),
        highlights: listingData.highlights ? (Array.isArray(listingData.highlights) ? listingData.highlights : listingData.highlights.split(',')) : [],
        bookingType: listingData.bookingType,
        weekendPremium: listingData.weekendPremium || 2,
        discounts: listingData.discounts ? (Array.isArray(listingData.discounts) ? listingData.discounts : listingData.discounts.split(',')) : [],
        safetyItems: listingData.safetyItems ? (Array.isArray(listingData.safetyItems) ? listingData.safetyItems : listingData.safetyItems.split(',')) : [],
        residentialAddress: residentialAddress,
        isBusiness: listingData.isBusiness === "yes",
        geometry: listingData.lng && listingData.lat ? {
            type: "Point",
            coordinates: [parseFloat(listingData.lng), parseFloat(listingData.lat)]
        } : listing.geometry
    }, { new: true, runValidators: true });

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${updatedListing._id}`);
};

// Helper function to determine category
function determineCategory(propertyType) {
    const propertyTypeToCategory = {
        house: "Rooms",
        apartment: "Rooms",
        condo: "Rooms",
        townhouse: "Rooms",
        flat: "Rooms",
        bnb: "Rooms",
        cabin: "Camping",
        camper: "Camping",
        barn: "Farms",
        castle: "Castles",
        boat: "Amazing Pools",
        casa: "General",
    };
    return propertyTypeToCategory[propertyType] || "General";
}

// GET HOST LISTINGS
module.exports.getHostListings = async (req, res) => {
  try {
    const listings = await Listing.find({ owner: req.user._id })
      .sort('-createdAt'); // Most recent first
    
    res.render('host/listings', {
      listings,
      title: 'Your Listings'
    });
  } catch (error) {
    console.error('Error fetching host listings:', error);
    req.flash('error', 'Error loading listings');
    res.redirect('/listings');
  }
};