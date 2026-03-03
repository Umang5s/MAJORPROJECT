const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const priceOverrideSchema = new Schema({
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
    price: {
        type: Number,
        required: true,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique combination of listing and date
priceOverrideSchema.index({ listing: 1, date: 1 }, { unique: true });

// Update timestamp on save
priceOverrideSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Get price for a specific date
priceOverrideSchema.statics.getPriceForDate = async function(listingId, date, defaultPrice) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const override = await this.findOne({
        listing: listingId,
        date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    return override ? override.price : defaultPrice;
};

// Get formatted date
priceOverrideSchema.methods.getFormattedDate = function() {
    const date = new Date(this.date);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

module.exports = mongoose.model('PriceOverride', priceOverrideSchema);