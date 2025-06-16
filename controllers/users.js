const User = require("../models/user");
const path = require("path");
const fs = require("fs");

module.exports.renderSignUpForm = async (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.registeredNewUser = async (req, res) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ username, email });
    let registeredUser = await User.register(newUser, password);
    //console.log(registeredUser);
    req.logIn(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "welcome to wanderlust!");
      res.redirect("/listings");
    });
  } catch (error) {
    req.flash("error", error.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = async (req, res) => {
  res.render("users/login.ejs");
};

module.exports.loginUser = async (req, res) => {
  req.flash("success", "welcome back to wanderlust!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
};

module.exports.logOutUser = (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged Out!");
    res.redirect("/listings");
  });
};

module.exports.renderSetPassword = (req, res) => {
  const isFirstTimeGoogleUser = !req.user.hash; // No password set = first time
  res.render("users/set-password", { isFirstTimeGoogleUser });
};


module.exports.setPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match.");
    return res.redirect("/set-password");
  }

  const user = req.user;
  await user.setPassword(password);
  await user.save();

  req.flash("success", "Password set successfully!");
  res.redirect("/listings");
};

module.exports.changePassword = async (req, res) => {
  const { oldPassword, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match.");
    return res.redirect("/set-password");
  }

  const user = req.user;

  user.changePassword(oldPassword, password, async function (err) {
    if (err) {
      req.flash("error", "Old password is incorrect.");
      return res.redirect("/set-password");
    }

    req.flash("success", "Password changed successfully.");
    res.redirect("/listings");
  });
};

module.exports.updateProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (req.file) {
    // Delete old local photo if it exists
    if (user.localPhoto) {
      const oldPath = path.join(__dirname, "..", "public", user.localPhoto);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new photo path relative to /public
    user.localPhoto = `/uploads/profile/${req.file.filename}`;
  }

  await user.save();
  req.flash("success", "Profile updated successfully!");
  res.redirect("/listings");
};

module.exports.deleteProfilePhoto = async (req, res) => {
  const user = req.user;

  if (!user.localPhoto) {
    req.flash("info", "No profile photo to delete.");
    return res.redirect("/listings");
  }

  const photoPath = path.join(__dirname, "..", "public", user.localPhoto);

  try {
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }

    user.localPhoto = "";
    await user.save();

    req.flash("success", "Profile photo deleted successfully!");
  } catch (err) {
    console.error("Error deleting file:", err);
    req.flash("error", "Error deleting photo.");
  }

  res.redirect("/listings");
};
