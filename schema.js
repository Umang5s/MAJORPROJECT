const Joi = require("joi");

// Define the valid categories that match your listing categories
const VALID_CATEGORIES = [
  "Trending",
  "Rooms",
  "Iconic Cities",
  "Mountains",
  "Castles",
  "Amazing Pools",
  "Camping",
  "Farms",
  "Arctic",
  "General"
];

// Map detailed property types to categories
const propertyTypeToCategoryMap = {
  // House types map to "Rooms" or "General"
  house: "Rooms",
  flat: "Rooms",
  apartment: "Rooms",
  condo: "Rooms",
  townhouse: "Rooms",
  bnb: "Rooms",
  cabin: "Camping",
  barn: "Farms",
  farm: "Farms",
  castle: "Castles",
  boat: "Amazing Pools",
  camper: "Camping",
  casa: "General"
};

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    // Basic fields
    title: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    price: Joi.number().required().min(0),
    weekendPrice: Joi.number().min(0).optional(),
    location: Joi.string().allow('').optional(),
    country: Joi.string().allow('').optional(),
    
    // Category is now derived from propertyType or set explicitly
    category: Joi.string()
      .valid(...VALID_CATEGORIES)
      .optional()
      .default('General'),
    
    originalCategory: Joi.string().allow('').optional(),
    status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
    totalRooms: Joi.number().min(1).default(1),

    // Multi-step form fields - propertyType is the main selector
    propertyType: Joi.string().valid(
      'house', 'apartment', 'condo', 'townhouse', 'flat', 
      'barn', 'bnb', 'boat', 'cabin', 'camper', 'casa', 'castle'
    ).allow('').optional(),
    
    guestAccess: Joi.string().valid('entire', 'room', 'shared').allow('').optional(),
    
    // detailedPropertyType is kept for backward compatibility
    detailedPropertyType: Joi.string().valid(
      'house', 'flat', 'barn', 'bnb', 'boat', 'cabin', 'camper', 'casa', 'castle'
    ).allow('').optional(),
    
    placeType: Joi.string().valid('entire', 'room', 'shared').allow('').optional(),

    // Address fields
    addressLine1: Joi.string().allow('').optional(),
    addressLine2: Joi.string().allow('').optional(),
    city: Joi.string().allow('').optional(),
    state: Joi.string().allow('').optional(),
    postalCode: Joi.string().allow('').optional(),
    instructions: Joi.string().allow('').optional(),

    // Guest/bed counts
    guests: Joi.number().min(1).default(4),
    bedrooms: Joi.number().min(1).default(1),
    beds: Joi.number().min(1).default(1),
    bathrooms: Joi.number().min(1).default(1),

    // Array fields (comma-separated strings in form data)
    amenities: Joi.string().allow('').optional(),
    highlights: Joi.string().allow('').optional(),
    discounts: Joi.string().allow('').optional(),
    safetyItems: Joi.string().allow('').optional(),

    // Booking settings
    bookingType: Joi.string().valid('approve', 'instant').default('approve'),

    // Business type (comes as string 'yes'/'no' from form)
    isBusiness: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid('yes', 'no', 'true', 'false')
    ).default(false),

    // Residential address as JSON string
    residentialAddress: Joi.string().allow('').optional(),

    // Image
    image: Joi.object({
      url: Joi.string().uri().allow('').optional(),
      filename: Joi.string().allow('').optional(),
    }).optional(),

    // Geometry
    geometry: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).optional(),
    }).optional(),

    // Additional photos
    additionalImages: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().optional(),
        filename: Joi.string().allow('').optional(),
      })
    ).optional(),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});

// Helper function to map propertyType to category
module.exports.getCategoryFromPropertyType = function(propertyType) {
  if (!propertyType) return 'General';
  return propertyTypeToCategoryMap[propertyType] || 'General';
};

// Helper function to validate if propertyType matches category
module.exports.validatePropertyTypeCategory = function(propertyType, category) {
  const expectedCategory = propertyTypeToCategoryMap[propertyType] || 'General';
  return expectedCategory === category;
};