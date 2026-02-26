const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const multer = require("multer");
const path = require("path");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const userController = require("../controllers/users.js");
const User = require("../models/user");
const Connection = require("../models/connection");
const Booking = require("../models/booking"); // optional, to show their past trips

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/profile/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------------------------
// Auth Routes
// ---------------------------
router
  .route("/signup")
  .get(userController.renderSignUpForm)
  .post(wrapAsync(userController.registeredNewUser));

// GET /login — capture a safe returnTo path if present (prevent open redirect)
router.get(
  "/login",
  (req, res, next) => {
    const returnTo = req.query.returnTo;
    // only accept local paths that start with '/'
    if (returnTo && typeof returnTo === "string" && returnTo.startsWith("/")) {
      req.session.returnTo = returnTo;
    }
    next();
  },
  userController.renderLoginForm,
);

router.post("/login", saveRedirectUrl, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      req.flash("error", info?.message || "Invalid email or password.");
      return res.redirect("/login");
    }

    // Prevent login if registered via Google only
    if (user.googleId && !user.hash) {
      req.flash(
        "error",
        "This account was created using Google. Please log in with Google.",
      );
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome back to Wanderlust!");
      const redirectUrl =
        req.query.returnTo || res.locals.redirectUrl || "/listings";
      delete req.session.returnTo;
      res.redirect(redirectUrl);
    });
  })(req, res, next);
});

// router.get("/allow-change-password", isLoggedIn, (req, res) => {
//   req.session.allowPasswordChange = true;
//   res.redirect("/set-password");
// });

// // GET: Show set/change password form
// router.get("/set-password", isLoggedIn, (req, res) => {
//   const user = req.user;

//   if (user.hash && !req.session.allowPasswordChange) {
//     req.flash("info", "You already have a password.");
//     return res.redirect("/listings");
//   }

//   const isFirstTimeGoogleUser = !user.hash;
//   res.render("users/set-password", { isFirstTimeGoogleUser });
// });

// // POST: Handle setting or changing password
// router.post("/set-password", isLoggedIn, async (req, res, next) => {
//   if (!req.user.hash) {
//     return userController.setPassword(req, res, next);
//   } else {
//     return userController.changePassword(req, res, next);
//   }
// });

// router.post(
//   "/profile/edit",
//   isLoggedIn,
//   upload.single("photo"),
//   wrapAsync(userController.updateProfile),
// );

// In your user routes
// router.post(
//   "/profile/delete-photo",
//   isLoggedIn,
//   userController.deleteProfilePhoto,
// );

// Logout
router.get("/logout", userController.logOutUser);

router.post("/logout", userController.logOutUser);

// View another user's public profile
// FIRST: List all users (more specific route)
router.get("/list", isLoggedIn, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .populate("profile")
      .limit(20);
    res.render("users/list", { users });
  } catch (err) {
    console.error(err);
    req.flash("error", "Could not load users.");
    res.redirect("/listings");
  }
});

// THEN: User profile by ID (parameterized route)
router.get("/:id", isLoggedIn, async (req, res) => {
  // Special case: if someone accidentally links to "/profile", redirect
  if (req.params.id === "profile") {
    req.flash("error", "Redirected to your profile.");
    return res.redirect("/profile");
  }

  // Validate that the ID is a 24-character hex string (MongoDB ObjectId)
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    req.flash("error", "Invalid user ID.");
    return res.redirect("/listings");
  }

  try {
    const user = await User.findById(req.params.id).populate("profile");
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/listings");
    }

    // Don't allow viewing your own profile here (use /profile)
    if (user._id.equals(req.user._id)) {
      return res.redirect("/profile");
    }

    // Check connection status between logged-in user and this user
    const connection = await Connection.findOne({
      $or: [
        { requester: req.user._id, recipient: user._id },
        { requester: user._id, recipient: req.user._id },
      ],
    });

    let connectionStatus = "none";
    let isRequester = false;

    if (connection) {
      connectionStatus = connection.status;
      isRequester = connection.requester.equals(req.user._id);
    }

    // Optional: fetch some of their past trips to show
    const now = new Date();
    const pastTrips = await Booking.find({
      guest: user._id,
      status: "booked",
      checkOut: { $lt: now },
    })
      .populate("listing")
      .limit(5);

    res.render("users/show", {
      profileUser: user,
      connectionStatus,
      isRequester,
      pastTrips,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Could not load user profile.");
    res.redirect("/listings");
  }
});

module.exports = router;
