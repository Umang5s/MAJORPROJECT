const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const blockedDateSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique combination of listing and date
blockedDateSchema.index({ listing: 1, date: 1 }, { unique: true });

// Check if a date is blocked
blockedDateSchema.statics.isDateBlocked = async function(listingId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const count = await this.countDocuments({
        listing: listingId,
        date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    return count > 0;
};

// Get formatted date
blockedDateSchema.methods.getFormattedDate = function() {
    const date = new Date(this.date);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

module.exports = mongoose.model('BlockedDate', blockedDateSchema);