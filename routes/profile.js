const express = require("express");
const router = express.Router();
const multer = require("multer");
const { storage, cloudinary } = require("../cloudConfig");
const upload = multer({ storage });

const Profile = require("../models/profile");
const User = require("../models/user");
const Booking = require("../models/booking");
const Connection = require("../models/connection"); // new model
const Review = require("../models/review"); // import your Review model
const { isLoggedIn } = require("../middleware");

const ALL_INTERESTS = [
  "Travel",
  "Music",
  "Coding",
  "Food",
  "Photography",
  "Fitness",
  "Art",
  "Movies",
  "Nature",
  "Books",
  "Live sports",
  "Outdoors",
  "Food scenes",
  "Live music",
  "Coffee",
  "Nightlife",
  "Cooking",
  "Animals",
  "Shopping",
  "Swimming",
  "Films",
  "Wine",
  "Water sports",
  "Local culture",
];

// profile.js – modified main route with logging
router.get("/", isLoggedIn, async (req, res) => {
  try {
    console.log("Profile route hit for user:", req.user._id);

    const user = await User.findById(req.user._id).populate("profile");
    console.log("User found:", user ? user._id : "null");

    const now = new Date();
    const pastTrips = await Booking.find({
      guest: req.user._id,
      status: 'booked',
      checkOut: { $lt: now }
    }).populate('listing').sort({ checkOut: -1 });
    console.log("Past trips count:", pastTrips.length);

    const connections = await Connection.find({
      $or: [
        { requester: req.user._id, status: 'accepted' },
        { recipient: req.user._id, status: 'accepted' }
      ]
    }).populate('requester recipient', 'name username profile');
    console.log("Connections count:", connections.length);

    const connectedUsers = connections.map(conn => {
      if (conn.requester._id.toString() === req.user._id.toString()) {
        return conn.recipient;
      } else {
        return conn.requester;
      }
    });

    res.render("users/profile", {
      currUser: user,
      pastTrips,
      connections: connectedUsers
    });
  } catch (err) {
    console.error("Error in profile route:", err);
    req.flash("error", "Something went wrong loading your profile.");
    res.redirect("/listings");
  }
});

// Other routes (edit, delete-photo) remain unchanged
router.get("/edit", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.user._id).populate("profile");
  res.render("users/profile_edit", {
    currUser: user,
    profile: user.profile,
    allInterests: ALL_INTERESTS,
  });
});

router.post("/edit", isLoggedIn, upload.single("avatar"), async (req, res) => {
  let profile = await Profile.findOne({ user: req.user._id });
  if (!profile) profile = new Profile({ user: req.user._id });

  // Step 1
  profile.wanted_to_go = req.body.wanted_to_go;
  profile.work = req.body.work;
  profile.fun_fact = req.body.fun_fact;
  profile.pets = req.body.pets;
  profile.decade_born = req.body.decade_born;
  profile.school = req.body.school;

  // Step 2
  profile.favourite_song = req.body.favourite_song;
  profile.spend_time = req.body.spend_time;
  profile.useless_skill = req.body.useless_skill;
  profile.languages = req.body.languages;
  profile.obsessed = req.body.obsessed;
  profile.bio_title = req.body.bio_title;
  profile.location = req.body.location;

  // Step 3
  profile.about = req.body.about;
  profile.stamps = req.body.stamps
    ? req.body.stamps.map((s) => ({ destination: s.destination }))
    : [];

  // Step 4
  profile.interests = [].concat(req.body.interests || []);
  profile.custom_interests = [].concat(req.body.custom_interests || []);

  // Avatar
  if (req.file) {
    if (profile.avatar?.filename)
      await cloudinary.uploader.destroy(profile.avatar.filename);
    profile.avatar = { url: req.file.path, filename: req.file.filename };
  }

  profile.profileCompleted = true;
  await profile.save();

  await User.findByIdAndUpdate(req.user._id, { profile: profile._id });
  req.flash("success", "Profile updated successfully!");
  res.redirect("/profile");
});

router.post("/delete-photo", isLoggedIn, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile?.avatar?.filename)
      return res.status(404).json({ success: false });

    await cloudinary.uploader.destroy(profile.avatar.filename);
    profile.avatar = null;
    await profile.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Delete photo error:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
