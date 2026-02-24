const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // Step 1 fields
  wanted_to_go: String,
  work: String,
  fun_fact: String,
  pets: String,
  decade_born: String,
  school: String,

  // Step 2 fields
  favourite_song: String,
  spend_time: String,
  useless_skill: String,
  languages: String,
  obsessed: String,
  bio_title: String,
  location: String,

  // Step 3 fields
  about: String,
  stamps: [{ destination: String }],

  // Step 4 fields
  interests: [String],
  custom_interests: [String],

  // Avatar
  avatar: {
    url: String,
    filename: String,
  },

  profileCompleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Profile", profileSchema);
