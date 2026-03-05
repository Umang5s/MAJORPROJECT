// services/bookingService.js
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const checkAvailability = require('../utils/checkAvailability');
const { sendEmail } = require('../utils/email');

class BookingService {
  
  /**
   * Process expired pending bookings and try to confirm next in queue
   */
  static async processExpiredPendingBookings() {
    try {
      
      // Find all expired pending bookings
      const expiredBookings = await Booking.find({
        status: 'pending',
        pendingExpiresAt: { $lt: new Date() }
      }).populate('listing');
      
      console.log(`Found ${expiredBookings.length} expired pending bookings`);
      
      for (const expiredBooking of expiredBookings) {
        await this.handleExpiredBooking(expiredBooking);
      }
      
      return { processed: expiredBookings.length };
    } catch (error) {
      console.error('Error processing expired bookings:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Handle a single expired booking
   */
  static async handleExpiredBooking(expiredBooking) {
    try {
      // Mark as expired
      expiredBooking.status = 'expired';
      await expiredBooking.save();
      
      console.log(`Booking ${expiredBooking._id} marked as expired`);
      
      // Notify the guest
      await this.notifyGuestBookingExpired(expiredBooking);
      
      // Try to confirm next pending booking for these dates
      await this.tryConfirmNextPendingBooking(
        expiredBooking.listing._id,
        expiredBooking.checkIn,
        expiredBooking.checkOut,
        expiredBooking.roomsBooked
      );
      
    } catch (error) {
      console.error(`Error handling expired booking ${expiredBooking._id}:`, error);
    }
  }
  
  /**
   * Try to confirm the next pending booking for given dates
   */
  static async tryConfirmNextPendingBooking(listingId, checkIn, checkOut, roomsNeeded) {
    try {
      // Check current availability
      const availability = await checkAvailability(
        listingId,
        checkIn,
        checkOut,
        roomsNeeded
      );
      
      if (!availability.available) {
        console.log('No rooms available for next pending booking');
        return false;
      }
      
      // Find the oldest pending booking for these dates
      const nextPendingBooking = await Booking.findOne({
        listing: listingId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        status: 'pending',
        roomsBooked: { $lte: availability.availableRooms }
      }).sort({ createdAt: 1 }); // Oldest first
      
      if (!nextPendingBooking) {
        console.log('No pending bookings found for these dates');
        return false;
      }
      
      // Confirm this booking
      nextPendingBooking.status = 'confirmed';
      nextPendingBooking.pendingExpiresAt = undefined; // Clear expiration
      await nextPendingBooking.save();
      
      
      // Notify guest that their booking is confirmed
      await this.notifyGuestBookingConfirmed(nextPendingBooking);
      
      return true;
    } catch (error) {
      console.error('Error confirming next pending booking:', error);
      return false;
    }
  }
  
  /**
   * Create a pending booking
   */
  static async createPendingBooking(bookingData) {
    try {
      // Check availability first
      const availability = await checkAvailability(
        bookingData.listing,
        bookingData.checkIn,
        bookingData.checkOut,
        bookingData.roomsBooked
      );
      
      if (!availability.available) {
        return {
          success: false,
          message: `Only ${availability.availableRooms} rooms available`,
          availableRooms: availability.availableRooms
        };
      }
      
      // Check if there are existing pending bookings for these dates
      const pendingCount = await Booking.countDocuments({
        listing: bookingData.listing,
        checkIn: new Date(bookingData.checkIn),
        checkOut: new Date(bookingData.checkOut),
        status: 'pending'
      });
      
      // If there are pending bookings, this one goes to pending
      const shouldBePending = pendingCount > 0;
      
      const booking = new Booking({
        ...bookingData,
        status: shouldBePending ? 'pending' : 'confirmed',
        pendingExpiresAt: shouldBePending ? new Date(Date.now() + 15 * 60 * 1000) : undefined
      });
      
      await booking.save();
      
      const populatedBooking = await Booking.findById(booking._id)
        .populate('listing')
        .populate('guest')
        .populate('host');
      
      if (booking.status === 'confirmed') {
        await this.notifyGuestBookingConfirmed(populatedBooking);
      } else {
        await this.notifyGuestBookingPending(populatedBooking);
      }
      
      return {
        success: true,
        booking,
        status: booking.status,
        message: booking.status === 'confirmed' 
          ? 'Booking confirmed!' 
          : 'Booking is pending confirmation. You will be notified when confirmed.'
      };
      
    } catch (error) {
      console.error('Error creating pending booking:', error);
      throw error;
    }
  }
  
  /**
   * Cancel a booking and try to confirm next in queue
   */
  static async cancelBooking(bookingId, cancelledBy) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('listing')
        .populate('guest')
        .populate('host');
      
      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }
      
      // Store details before cancelling
      const { listing, checkIn, checkOut, roomsBooked } = booking;
      
      // Cancel the booking
      booking.status = 'cancelled';
      await booking.save();
      
      console.log(`Booking ${bookingId} cancelled by ${cancelledBy}`);
      
      // Try to confirm next pending booking for these dates
      await this.tryConfirmNextPendingBooking(
        listing._id,
        checkIn,
        checkOut,
        roomsBooked
      );
      
      return { success: true, booking };
      
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Notification methods
   */
  static async notifyGuestBookingConfirmed(booking) {
    try {
      const guestEmail = booking.guestDetails?.email || booking.guest?.email;
      if (!guestEmail) return;
      
      await sendEmail({
        templateName: "bookingConfirmation",
        to: guestEmail,
        subject: "Your booking is confirmed!",
        data: {
          userName: booking.guestDetails?.name || booking.guest?.username || 'Guest',
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          totalPrice: booking.price,
          roomsBooked: booking.roomsBooked,
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || 'http://localhost:3000'
        }
      });
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  }
  
  static async notifyGuestBookingPending(booking) {
    try {
      const guestEmail = booking.guestDetails?.email || booking.guest?.email;
      if (!guestEmail) return;
      
      await sendEmail({
        templateName: "bookingPending",
        to: guestEmail,
        subject: "Your booking is pending confirmation",
        data: {
          userName: booking.guestDetails?.name || booking.guest?.username || 'Guest',
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          totalPrice: booking.price,
          roomsBooked: booking.roomsBooked,
          bookingId: booking._id,
          expiresIn: '15 minutes',
          siteUrl: process.env.SITE_URL || 'http://localhost:3000'
        }
      });
    } catch (error) {
      console.error('Error sending pending email:', error);
    }
  }
  
  static async notifyGuestBookingExpired(booking) {
    try {
      const guestEmail = booking.guestDetails?.email || booking.guest?.email;
      if (!guestEmail) return;
      
      await sendEmail({
        templateName: "bookingExpired",
        to: guestEmail,
        subject: "Your pending booking has expired",
        data: {
          userName: booking.guestDetails?.name || booking.guest?.username || 'Guest',
          listingTitle: booking.listing.title,
          from: booking.checkIn.toDateString(),
          to: booking.checkOut.toDateString(),
          bookingId: booking._id,
          siteUrl: process.env.SITE_URL || 'http://localhost:3000'
        }
      });
    } catch (error) {
      console.error('Error sending expiration email:', error);
    }
  }
}

module.exports = BookingService;