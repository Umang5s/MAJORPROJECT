const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  // Username is optional (for Google users, can be null)
  username: {
    type: String,
    unique: true,
    sparse: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    default: "", // optional but good to have default
  },
  avatar: {
    type: String, // Google profile photo URL
    default: "",
  },
  localPhoto: {
    type: String, // Local uploaded profile photo path or URL
    default: "",
  },
  watchlists: [{ type: mongoose.Schema.Types.ObjectId, ref: "Watchlist" }],
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
});

// Plugin for passport-local-mongoose must come after schema definition
userSchema.plugin(passportLocalMongoose, {
  usernameField: "email", // Use email for local auth login
});

module.exports = mongoose.model("User", userSchema);
