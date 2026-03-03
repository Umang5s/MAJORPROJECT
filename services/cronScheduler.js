// services/cronScheduler.js
const cron = require('node-cron');
const { 
  activateReviewWindows, 
  closeExpiredReviewWindows,
  publishExpiredReviews 
} = require('./reviewService');

// Initialize all cron jobs
function initCronJobs() {
  
  // Run every day at 1:00 AM - Activate new review windows
  cron.schedule('0 1 * * *', async () => {
    console.log('='.repeat(50));
    console.log('Running daily review window activation...');
    console.log('='.repeat(50));
    
    try {
      const result = await activateReviewWindows();
      console.log('Review window activation result:', result);
    } catch (error) {
      console.error('Cron job error (activateReviewWindows):', error);
    }
  });
  
  // Run every day at 2:00 AM - Close expired review windows
  cron.schedule('0 2 * * *', async () => {
    console.log('='.repeat(50));
    console.log('Checking for expired review windows...');
    console.log('='.repeat(50));
    
    try {
      const result = await closeExpiredReviewWindows();
      console.log('Expired review windows result:', result);
    } catch (error) {
      console.error('Cron job error (closeExpiredReviewWindows):', error);
    }
  });
  
  // Run every day at 3:00 AM - Publish reviews after 14 days
  cron.schedule('0 3 * * *', async () => {
    console.log('='.repeat(50));
    console.log('Publishing expired reviews...');
    console.log('='.repeat(50));
    
    try {
      const result = await publishExpiredReviews();
      console.log('Expired reviews publication result:', result);
    } catch (error) {
      console.error('Cron job error (publishExpiredReviews):', error);
    }
  });
  
  console.log('✅ Cron jobs scheduled successfully');
}

module.exports = { initCronJobs };