// utils/utcDate.js
module.exports = function utcDate(dateString) {
    if (!dateString) return null;
    
    // If it's already a Date object
    if (dateString instanceof Date) {
        const d = new Date(dateString);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }
    
    // Handle string input (YYYY-MM-DD)
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};