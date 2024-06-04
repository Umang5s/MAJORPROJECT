const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");

const userController = require("../controllers/users.js");

router.route("/signup")
.get(userController.renderSignUpForm) //signup form
.post(wrapAsync(userController.registeredNewUser)); //newuserregistered

router.route("/login")
.get(userController.renderLoginForm)  //login form
.post(saveRedirectUrl,
    passport.authenticate("local", { failureRedirect: "/login", failureMessage: true }),
    userController.loginUser
);  //existing user logged in 

//logout user    
router.get("/logout",userController.logOutUser);

module.exports = router;
