if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require("connect-mongo");

const User = require("./models/user.js");
const ExpressError = require("./utils/ExpressError.js");

// Routes
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const authRouter = require("./routes/auth.js");
const watchlistRouter = require("./routes/watchlist.js");
const bookingRoutes = require("./routes/booking");
const apiRoutes = require("./routes/api");
const searchRoutes = require("./routes/search");
const modeRouter = require("./routes/mode"); // NEW: mode switch route
const hostRouter = require("./routes/host"); // NEW: host dashboard routes
const { setUserMode } = require("./middleware");
const profileRoutes = require("./routes/profile.js");
const connectionRoutes = require("./routes/connections");
const messageRoutes = require("./routes/messages");
const travelBuddyRoutes = require("./routes/travelBuddies");
require("./passport");

const Connection = require("./models/connection.js");

// MongoDB Connection
const dbUrl = process.env.ATLAS_URL;

mongoose
  .connect(dbUrl)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// View engine and static files
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Set default layout
app.use((req, res, next) => {
  res.locals.layout = "layouts/boilerplate";
  next();
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// Add this after your other app.use middleware
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});
// Session store
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret: process.env.SECRET },
  touchAfter: 24 * 3600,
});
store.on("error", (e) => {
  console.log("Session store error:", e);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
};

app.use(session(sessionOptions));
app.use(flash());

// Passport config
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy({ usernameField: "email" }, User.authenticate()),
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async (req, res, next) => {
  if (req.user) {
    const fullUser = await User.findById(req.user._id).populate("profile");

    res.locals.currUser = fullUser;
  } else {
    res.locals.currUser = null;
  }
  if (req.user) {
    const pendingCount = await Connection.countDocuments({
      recipient: req.user._id,
      status: "pending",
    });
    res.locals.pendingRequestCount = pendingCount;
  }
  res.locals.mode = req.session.mode || "traveller";
  res.locals.requestOriginal = req.originalUrl;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentPath = req.path;

  next();
});

app.use(setUserMode);

// Mode switch route
app.use("/mode", modeRouter);

// Host routes
app.use("/host", hostRouter);

// Other routes (unchanged)
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
// Specific routes first
app.use("/profile", profileRoutes);
app.use("/watchlist", watchlistRouter);
app.use(bookingRoutes);
app.use("/api", apiRoutes);
app.use("/search", searchRoutes);
app.use("/connections", connectionRoutes);
app.use("/messages", messageRoutes);
app.use("/travel-buddies", travelBuddyRoutes);

// Root-level routes (signup, login, logout, and :id) – these are less specific
app.use("/users", userRouter);
app.use("/", authRouter); // includes /auth/google etc.

// Catch all
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// Error handler
app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something went wrong!";
  res.status(statusCode).render("listings/error", { err });
});

// require("./services/reminderService");

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Serving on port ${port}`);
});
