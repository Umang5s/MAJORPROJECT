// utils/normalizeDate.js
module.exports = (date) => {
    if (!date) return null;
    
    const d = new Date(date);
    // Set to UTC midnight for consistent comparison
    d.setUTCHours(0, 0, 0, 0);
    return d;
};