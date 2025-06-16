const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("./models/user");

passport.use(
  new LocalStrategy({ usernameField: "email" }, User.authenticate())
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) return done(null, existingUser);

        const email = profile.emails[0].value;

        // If email exists but Google ID not set (merge accounts)
        let user = await User.findOne({ email });

        if (user && !user.googleId) {
          user.googleId = profile.id;
          user.name = profile.displayName;
          user.avatar = profile.photos?.[0]?.value;
          user.username = email;

          await user.save();
        } else if (!user) {
          user = new User({
            googleId: profile.id,
            email: email,
            username: email,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
          });
          await user.save();
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select("+hash");
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
