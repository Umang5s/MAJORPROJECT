const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const watchlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  listings: [
    {
      type: Schema.Types.ObjectId,
      ref: "Listing",
    },
  ],
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

module.exports = mongoose.model("Watchlist", watchlistSchema);
