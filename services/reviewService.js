// services/reviewService.js
const Booking = require("../models/booking");
const Review = require("../models/review");
const { sendEmail } = require("../utils/email");

/**
 * Run this function daily to activate review windows for completed bookings
 */
async function activateReviewWindows() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Find bookings that checked out yesterday and are confirmed
    const bookings = await Booking.find({
      checkOut: {
        $gte: yesterday,
        $lt: today
      },
      status: 'confirmed',
      canReview: false
    }).populate('guest').populate('listing').populate('host');
    
    console.log(`[${new Date().toISOString()}] Found ${bookings.length} bookings to activate review windows`);
    
    const results = {
      activated: 0,
      errors: []
    };
    
    for (const booking of bookings) {
      try {
        // Set review window (14 days from checkout)
        const reviewWindowExpires = new Date(booking.checkOut);
        reviewWindowExpires.setDate(reviewWindowExpires.getDate() + 14);
        
        booking.canReview = true;
        booking.reviewWindowExpires = reviewWindowExpires;
        await booking.save();
        
        // Send email notification to guest
        await sendReviewReminderEmail(booking);
        
        results.activated++;
        console.log(`Activated review window for booking ${booking._id}`);
      } catch (err) {
        console.error(`Error activating booking ${booking._id}:`, err);
        results.errors.push({ bookingId: booking._id, error: err.message });
      }
    }
    
    return { success: true, ...results };
  } catch (error) {
    console.error('Error activating review windows:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email to guest inviting them to review
 */
async function sendReviewReminderEmail(booking) {
  // Skip if no email
  if (!booking.guest?.email) return;
  
  const emailData = {
    to: booking.guest.email,
    subject: `How was your stay at ${booking.listing?.title || 'your stay'}?`,
    template: 'reviewReminder',
    context: {
      guestName: booking.guest.username || 'Guest',
      listingTitle: booking.listing?.title || 'the property',
      bookingId: booking._id,
      reviewUrl: `${process.env.SITE_URL || 'http://localhost:3000'}/bookings/${booking._id}/review`,
      expiresAt: booking.reviewWindowExpires?.toLocaleDateString() || '14 days'
    }
  };
  
  await sendEmail(emailData);
}

/**
 * Close expired review windows
 */
async function closeExpiredReviewWindows() {
  try {
    const result = await Booking.updateMany(
      {
        canReview: true,
        reviewWindowExpires: { $lt: new Date() }
      },
      {
        canReview: false
      }
    );
    
    console.log(`[${new Date().toISOString()}] Closed ${result.modifiedCount} expired review windows`);
    return { success: true, closed: result.modifiedCount };
  } catch (error) {
    console.error('Error closing expired review windows:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check and publish reviews after 14 days
 */
async function publishExpiredReviews() {
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    // Find bookings where reviews are still unpublished after 14 days
    const bookings = await Booking.find({
      checkOut: { $lt: fourteenDaysAgo },
      $or: [
        { guestReviewed: true, hostReviewed: false },
        { guestReviewed: false, hostReviewed: true }
      ]
    });
    
    console.log(`[${new Date().toISOString()}] Found ${bookings.length} bookings with pending review publications`);
    
    for (const booking of bookings) {
      await checkAndPublishReviews(booking._id);
    }
    
    return { success: true, processed: bookings.length };
  } catch (error) {
    console.error('Error publishing expired reviews:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if both reviews are submitted and publish them
 */
async function checkAndPublishReviews(bookingId) {
  const booking = await Booking.findById(bookingId);
  const reviews = await Review.find({ booking: bookingId });
  
  if (!reviews || reviews.length === 0) {
    return false;
  }
  
  const guestReview = reviews.find(r => r.reviewType === 'guest-to-host');
  const hostReview = reviews.find(r => r.reviewType === 'host-to-guest');
  
  // Condition 1: Both reviews submitted
  if (guestReview && hostReview) {
    guestReview.isPublished = true;
    hostReview.isPublished = true;
    await guestReview.save();
    await hostReview.save();
    
    // Update listing averages with try-catch
    try {
      const Listing = require('../models/listing');
      await updateListingAverages(guestReview.listing);
    } catch (error) {
      console.error('Error updating listing averages:', error);
    }
    
    // Notify both parties
    await notifyReviewsPublished(booking, guestReview, hostReview);
    return true;
  }
  
  // Condition 2: 14 days passed since checkout
  const fourteenDaysAfter = new Date(booking.checkOut);
  fourteenDaysAfter.setDate(fourteenDaysAfter.getDate() + 14);
  
  if (new Date() > fourteenDaysAfter) {
    if (guestReview && !guestReview.isPublished) {
      guestReview.isPublished = true;
      await guestReview.save();
      try {
        const Listing = require('../models/listing');
        await updateListingAverages(guestReview.listing);
      } catch (error) {
        console.error('Error updating listing averages:', error);
      }
    }
    if (hostReview && !hostReview.isPublished) {
      hostReview.isPublished = true;
      await hostReview.save();
    }
    return true;
  }
  
  return false;
}

/**
 * Update listing averages
 */
async function updateListingAverages(listingId) {
  const Listing = require('../models/listing');
  
  // Only consider published guest reviews
  const reviews = await Review.find({ 
    listing: listingId, 
    reviewType: 'guest-to-host',
    isPublished: true 
  });
  
  const count = reviews.length;
  
  if (count === 0) {
    // Set all averages to 0 instead of null/undefined
    await Listing.findByIdAndUpdate(listingId, {
      avgRating: 0,
      avgCleanliness: 0,
      avgAccuracy: 0,
      avgCommunication: 0,
      avgLocation: 0,
      avgCheckIn: 0,
      avgValue: 0,
      reviewCount: 0,
      ratingsUpdatedAt: new Date()
    });
    return;
  }
  
  // Initialize sums
  const sums = {
    cleanliness: 0,
    accuracy: 0,
    communication: 0,
    location: 0,
    checkIn: 0,
    value: 0
  };
  
  // Sum up all ratings
  reviews.forEach(r => {
    // Handle both old and new schema formats
    sums.cleanliness += r.cleanliness?.rating || r.cleanliness || 0;
    sums.accuracy += r.accuracy?.rating || r.accuracy || 0;
    sums.communication += r.communication?.rating || r.communication || 0;
    sums.location += r.location?.rating || r.location || 0;
    sums.checkIn += r.checkIn?.rating || r.checkIn || 0;
    sums.value += r.value?.rating || r.value || 0;
  });
  
  // Calculate averages with safety checks
  const avgCleanliness = count > 0 ? sums.cleanliness / count : 0;
  const avgAccuracy = count > 0 ? sums.accuracy / count : 0;
  const avgCommunication = count > 0 ? sums.communication / count : 0;
  const avgLocation = count > 0 ? sums.location / count : 0;
  const avgCheckIn = count > 0 ? sums.checkIn / count : 0;
  const avgValue = count > 0 ? sums.value / count : 0;
  
  // Overall average of all categories
  const avgRating = (avgCleanliness + avgAccuracy + avgCommunication + avgLocation + avgCheckIn + avgValue) / 6;
  
  // Round to 2 decimal places and ensure it's a valid number
  const roundedAvgRating = isNaN(avgRating) ? 0 : Math.round(avgRating * 100) / 100;
  const roundedCleanliness = isNaN(avgCleanliness) ? 0 : Math.round(avgCleanliness * 100) / 100;
  const roundedAccuracy = isNaN(avgAccuracy) ? 0 : Math.round(avgAccuracy * 100) / 100;
  const roundedCommunication = isNaN(avgCommunication) ? 0 : Math.round(avgCommunication * 100) / 100;
  const roundedLocation = isNaN(avgLocation) ? 0 : Math.round(avgLocation * 100) / 100;
  const roundedCheckIn = isNaN(avgCheckIn) ? 0 : Math.round(avgCheckIn * 100) / 100;
  const roundedValue = isNaN(avgValue) ? 0 : Math.round(avgValue * 100) / 100;
  
  await Listing.findByIdAndUpdate(listingId, {
    avgRating: roundedAvgRating,
    avgCleanliness: roundedCleanliness,
    avgAccuracy: roundedAccuracy,
    avgCommunication: roundedCommunication,
    avgLocation: roundedLocation,
    avgCheckIn: roundedCheckIn,
    avgValue: roundedValue,
    reviewCount: count,
    ratingsUpdatedAt: new Date()
  });
}

/**
 * Notify both parties when reviews are published
 */
async function notifyReviewsPublished(booking, guestReview, hostReview) {
  const { sendEmail } = require('../utils/email');
  
  // Notify guest that their review is published
  if (guestReview && booking.guest?.email) {
    await sendEmail({
      to: booking.guest.email,
      subject: 'Your review has been published!',
      template: 'reviewPublished',
      context: {
        name: booking.guest.username || 'Guest',
        listingTitle: booking.listing?.title || 'the property',
        reviewUrl: `${process.env.SITE_URL || 'http://localhost:3000'}/listings/${booking.listing}`
      }
    });
  }
  
  // Notify host that they have a new review
  if (guestReview && booking.host?.email) {
    await sendEmail({
      to: booking.host.email,
      subject: 'You received a new review!',
      template: 'newReviewNotification',
      context: {
        hostName: booking.host.username || 'Host',
        listingTitle: booking.listing?.title || 'your property',
        reviewUrl: `${process.env.SITE_URL || 'http://localhost:3000'}/listings/${booking.listing}`
      }
    });
  }
}

module.exports = {
  activateReviewWindows,
  closeExpiredReviewWindows,
  publishExpiredReviews,
  checkAndPublishReviews,
  updateListingAverages
};