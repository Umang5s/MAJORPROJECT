const Listing = require("./models/listing.js");
const Booking = require("./models/booking.js");
const Review = require("./models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, hostReviewSchema } = require("./schema.js");


// ========== AUTHENTICATION MIDDLEWARE ==========

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        // save current page
        req.session.returnTo = req.originalUrl;
        req.flash("error", "Please login first!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

// ========== LISTING MIDDLEWARE ==========

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You aren't owner of this listing!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

// ========== REVIEW MIDDLEWARE ==========

// Validate review (including category ratings)
module.exports.validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        req.flash("error", errMsg);
        return res.redirect("back");
    } else {
        next();
    }
};

// Check if user is review author
module.exports.isReviewAuthor = async (req, res, next) => {
    let { reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if (!review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not author of this review!");
        return res.redirect("back");
    }
    next();
};

// Check if user can review a booking (guest, window open, not already reviewed)
module.exports.canReviewBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings/my');
        }
        
        // Check if user is the guest
        if (!booking.guest.equals(req.user._id)) {
            req.flash('error', 'You are not authorized to review this booking');
            return res.redirect('/bookings/my');
        }
        
        // Check if review window is open
        if (!booking.canReview) {
            req.flash('error', 'It is not time to review yet. Reviews open after checkout.');
            return res.redirect(`/bookings/${bookingId}`);
        }
        
        // Check if review window expired
        if (booking.reviewWindowExpires && booking.reviewWindowExpires < new Date()) {
            req.flash('error', 'The review window has expired (14 days after checkout)');
            return res.redirect(`/bookings/${bookingId}`);
        }
        
        // Check if already reviewed
        if (booking.guestReviewed) {
            req.flash('error', 'You have already reviewed this booking');
            return res.redirect(`/bookings/${bookingId}`);
        }
        
        next();
    } catch (error) {
        console.error('canReviewBooking error:', error);
        req.flash('error', 'Error checking review eligibility');
        res.redirect('back');
    }
};

// Check if host can review a guest
module.exports.canHostReviewGuest = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings/received');
        }
        
        // Check if user is the host
        if (!booking.host.equals(req.user._id)) {
            req.flash('error', 'You are not authorized to review this guest');
            return res.redirect('/bookings/received');
        }
        
        // Check if review window is open
        if (!booking.canReview) {
            req.flash('error', 'Review window is not open yet');
            return res.redirect('/bookings/received');
        }
        
        // Check if review window expired
        if (booking.reviewWindowExpires && booking.reviewWindowExpires < new Date()) {
            req.flash('error', 'The review window has expired');
            return res.redirect('/bookings/received');
        }
        
        // Check if already reviewed
        if (booking.hostReviewed) {
            req.flash('error', 'You have already reviewed this guest');
            return res.redirect('/bookings/received');
        }
        
        next();
    } catch (error) {
        console.error('canHostReviewGuest error:', error);
        req.flash('error', 'Error checking review eligibility');
        res.redirect('back');
    }
};

// Check if user can edit a review (within 48 hours and not published)
module.exports.canEditReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params;
        
        const review = await Review.findById(reviewId);
        
        if (!review) {
            req.flash('error', 'Review not found');
            return res.redirect('back');
        }
        
        // Check if user is the author
        if (!review.author.equals(req.user._id)) {
            req.flash('error', 'You can only edit your own reviews');
            return res.redirect('back');
        }
        
        // Check if within 48-hour edit window
        const hoursSinceCreation = (new Date() - review.createdAt) / (1000 * 60 * 60);
        if (hoursSinceCreation > 48) {
            req.flash('error', 'Reviews can only be edited within 48 hours of submission');
            return res.redirect('back');
        }
        
        // Check if already published
        if (review.isPublished) {
            req.flash('error', 'Published reviews cannot be edited');
            return res.redirect('back');
        }
        
        next();
    } catch (error) {
        console.error('canEditReview error:', error);
        req.flash('error', 'Error checking edit permissions');
        res.redirect('back');
    }
};

// Check if user can reply to a review (must be host)
module.exports.canReplyToReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params;
        
        const review = await Review.findById(reviewId)
            .populate('listing')
            .populate('booking');
        
        if (!review) {
            req.flash('error', 'Review not found');
            return res.redirect('back');
        }
        
        // Check if this is a guest review (hosts can't reply to host reviews)
        if (review.reviewType !== 'guest-to-host') {
            req.flash('error', 'You can only reply to guest reviews');
            return res.redirect('back');
        }
        
        // Check if user is the host of this listing
        const isHost = review.booking.host.equals(req.user._id) || 
                       review.listing.owner.equals(req.user._id);
        
        if (!isHost) {
            req.flash('error', 'Only the host can reply to reviews');
            return res.redirect('back');
        }
        
        next();
    } catch (error) {
        console.error('canReplyToReview error:', error);
        req.flash('error', 'Error checking reply permissions');
        res.redirect('back');
    }
};

// Validate host reply
module.exports.validateReply = (req, res, next) => {
    let { error } = hostReviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        req.flash("error", errMsg);
        return res.redirect("back");
    } else {
        next();
    }
};

// ========== BOOKING MIDDLEWARE ==========

// Check if user is booking guest
module.exports.isBookingGuest = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings/my');
        }
        
        if (!booking.guest.equals(req.user._id)) {
            req.flash('error', 'You are not authorized to access this booking');
            return res.redirect('/bookings/my');
        }
        
        next();
    } catch (error) {
        console.error('isBookingGuest error:', error);
        req.flash('error', 'Error checking booking permissions');
        res.redirect('back');
    }
};

// Check if user is booking host
module.exports.isBookingHost = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings/received');
        }
        
        if (!booking.host.equals(req.user._id)) {
            req.flash('error', 'You are not authorized to access this booking');
            return res.redirect('/bookings/received');
        }
        
        next();
    } catch (error) {
        console.error('isBookingHost error:', error);
        req.flash('error', 'Error checking booking permissions');
        res.redirect('back');
    }
};

// ========== USER MODE MIDDLEWARE ==========

module.exports.setUserMode = (req, res, next) => {
    // Default to "traveller" if no mode is set
    if (!req.session.mode) {
        req.session.mode = "traveller";
    }

    res.locals.mode = req.session.mode;
    res.locals.isHost = req.session.mode === "host";

    next();
};

// Require host mode middleware
module.exports.requireHost = (req, res, next) => {
    // First check if user is logged in
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash("error", "Please login first to access host dashboard!");
        return res.redirect("/login");
    }
    
    // Then check if user is in host mode
    if (req.session.mode !== "host") {
        req.flash("error", "You need to switch to host mode to access this page!");
        return res.redirect("/listings");
    }
    
    next();
};

// ========== HELPER MIDDLEWARE ==========

// Check if listing exists
module.exports.isListingExists = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        
        if (!listing) {
            req.flash('error', 'Listing not found!');
            return res.redirect('/listings');
        }
        
        res.locals.listing = listing;
        next();
    } catch (error) {
        console.error('isListingExists error:', error);
        req.flash('error', 'Error finding listing');
        res.redirect('/listings');
    }
};

// Add to your middleware.js
module.exports.validateHostReview = (req, res, next) => {
    let { error } = hostReviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        req.flash("error", errMsg);
        return res.redirect("back");
    } else {
        next();
    }
};


module.exports.trackUniqueView = async (req, res, next) => {
  try {
    console.log("========== VIEW TRACKER STARTED ==========");
    console.log("Request URL:", req.originalUrl);
    console.log("Request Path:", req.path);
    console.log("Request BaseUrl:", req.baseUrl);
    console.log("Full URL:", req.originalUrl);
    
    // Check if this is a listing route
    const isListingRoute = req.originalUrl.match(/^\/listings\/[a-f0-9]{24}$/);
    
    console.log("Is listing route?", isListingRoute ? "Yes" : "No");
    
    if (isListingRoute) {
      console.log("✅ Matched listing route");
      
      const listingId = req.params.id;
      console.log("Listing ID:", listingId);
      
      // Get viewer identifier
      let viewerId;
      
      if (req.user && req.user._id) {
        viewerId = req.user._id.toString();
        console.log("👤 Logged in user ID:", viewerId);
      } else {
        viewerId = req.ip || req.connection.remoteAddress;
        console.log("🌐 Guest IP:", viewerId);
      }
      
      // Find the listing
      console.log("Finding listing...");
      const listing = await Listing.findById(listingId);
      
      if (!listing) {
        console.log("❌ Listing not found!");
        return next();
      }
      
      console.log("✅ Listing found:", listing._id.toString());
      console.log("Current uniqueViewers:", listing.uniqueViewers);
      console.log("Current uniqueViewers length:", listing.uniqueViewers?.length || 0);
      
      // Initialize if needed
      if (!listing.uniqueViewers) {
        console.log("Initializing uniqueViewers array");
        listing.uniqueViewers = [];
      }
      
      // Check if viewer exists
      const viewerExists = listing.uniqueViewers.some(id => {
        const exists = String(id) === String(viewerId);
        if (exists) console.log(`Viewer ${viewerId} already exists`);
        return exists;
      });
      
      if (!viewerExists) {
        // NEW VIEWER
        console.log(`➕ Adding new viewer: ${viewerId}`);
        listing.uniqueViewers.push(viewerId);
        console.log(`New unique count: ${listing.uniqueViewers.length}`);
      }
      
      // ALWAYS update last viewed
      listing.lastViewedAt = new Date();
      
      // Save with validation disabled
      console.log("Saving listing...");
      await listing.save({ validateBeforeSave: false });
      console.log("✅ Save successful");
      
    } else {
      console.log("❌ Not a listing route, skipping");
    }
    
    console.log("========== VIEW TRACKER COMPLETED ==========");
    next();
  } catch (error) {
    console.error("❌ ERROR in view tracker:", error);
    next();
  }
};

