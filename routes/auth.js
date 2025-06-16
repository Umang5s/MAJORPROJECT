const express = require("express");
const passport = require("passport");
const router = express.Router();
const { saveRedirectUrl } = require("../middleware");

// Route to start Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback route after Google authenticates the user
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    if (!req.user.hash) {
      // ✅ Redirect to password creation page
      return res.redirect("/set-password");
    }

    req.flash("success", "Welcome back!");
    res.redirect("/listings");
  }
);


// Logout (optional duplicate if you want OAuth logout here too)
router.get("/auth/logout", (req, res) => {
  req.logout(() => {
    req.flash("success", "Logged out successfully!");
    res.redirect("/listings");
  });
});

router.post("/login", saveRedirectUrl, async (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      req.flash("error", "Invalid email or password.");
      return res.redirect("/login");
    }

    // Check for Google-only accounts without local password
    if (user.googleId && !user.hash) {
      req.flash(
        "error",
        "This account was created using Google. Please log in with Google."
      );
      return res.redirect("/login");
    }

    // Login the user manually
    req.logIn(user, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome back to Wanderlust!");
      const redirectUrl = res.locals.redirectUrl || "/listings";
      res.redirect(redirectUrl);
    });
  })(req, res, next);
});

module.exports = router;
