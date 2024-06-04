const User = require("../models/user");

module.exports.renderSignUpForm = async (req, res) => {
    res.render("users/signup.ejs");
}

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
}

module.exports.renderLoginForm =  async (req, res) => {
    res.render("users/login.ejs");
}

module.exports.loginUser =  async (req, res) => {
    req.flash("success", "welcome back to wanderlust!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
}

module.exports.logOutUser =  (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You are logged Out!");
        res.redirect("/listings");
    })
} 