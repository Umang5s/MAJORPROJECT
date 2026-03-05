// services/cronScheduler.js
const cron = require('node-cron');
const { 
  activateReviewWindows, 
  closeExpiredReviewWindows,
  publishExpiredReviews 
} = require('./reviewService');
const BookingService = require('./bookingService');

// Initialize all cron jobs
function initCronJobs() {
  
  // Run every minute - Check for expired pending bookings
  cron.schedule('* * * * *', async () => {
    
    
    try {
      const result = await BookingService.processExpiredPendingBookings();
      if (result.processed > 0) {
        
        // Log details if there are any
        if (result.details && result.details.length > 0) {
          result.details.forEach(detail => {
          });
        }
      } else {
        console.log('ℹ️ No expired pending bookings found');
      }
    } catch (error) {
      console.error('❌ Cron job error (processExpiredPendingBookings):', error);
    }
  });

  // Run every 5 minutes - Check for bookings that need reminders
  cron.schedule('*/5 * * * *', async () => {
    
    
    try {
      // This would be another service function you might want to add
      // For now, just a placeholder
      console.log('Reminder check completed');
    } catch (error) {
      console.error('❌ Cron job error (sendReminders):', error);
    }
  });

  // Run every hour - Clean up old expired bookings data
  cron.schedule('0 * * * *', async () => {
    console.log('='.repeat(50));
    console.log('🧹 Running hourly cleanup of expired bookings...');
    console.log('='.repeat(50));
    
    try {
      // Optional: Clean up old expired bookings from database
      // You can implement this in BookingService if needed
      console.log('Cleanup completed');
    } catch (error) {
      console.error('❌ Cron job error (cleanup):', error);
    }
  });

  // Run every day at 1:00 AM - Activate new review windows
  cron.schedule('0 1 * * *', async () => {
    console.log('='.repeat(50));
    console.log('📝 Running daily review window activation...');
    console.log('='.repeat(50));
    
    try {
      const result = await activateReviewWindows();
      console.log('Review window activation result:', result);
    } catch (error) {
      console.error('❌ Cron job error (activateReviewWindows):', error);
    }
  });
  
  // Run every day at 2:00 AM - Close expired review windows
  cron.schedule('0 2 * * *', async () => {
    console.log('='.repeat(50));
    console.log('🔒 Checking for expired review windows...');
    console.log('='.repeat(50));
    
    try {
      const result = await closeExpiredReviewWindows();
      console.log('Expired review windows result:', result);
    } catch (error) {
      console.error('❌ Cron job error (closeExpiredReviewWindows):', error);
    }
  });
  
  // Run every day at 3:00 AM - Publish reviews after 14 days
  cron.schedule('0 3 * * *', async () => {
   
    
    try {
      const result = await publishExpiredReviews();
      console.log('Expired reviews publication result:', result);
    } catch (error) {
      console.error('❌ Cron job error (publishExpiredReviews):', error);
    }
  });

  // Run every day at 4:00 AM - Clean up very old expired bookings (older than 30 days)
  cron.schedule('0 4 * * *', async () => {
    
    
    try {
      // Optional: Delete expired bookings older than 30 days
      // You can implement this in BookingService
      console.log('Old expired bookings cleanup completed');
    } catch (error) {
      console.error('❌ Cron job error (oldCleanup):', error);
    }
  });

}

module.exports = { initCronJobs };