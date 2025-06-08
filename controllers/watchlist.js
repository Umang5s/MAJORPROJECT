const Watchlist = require("../models/watchlist");
const mongoose = require("mongoose");

module.exports.addToWatchlist = async (req, res) => {
  try {
    const { listingId, newWatchlist, existingWatchlist } = req.body;
    const userId = req.user._id;

    let watchlist;

    if (newWatchlist && newWatchlist.trim() !== "") {
      // Create new watchlist
      watchlist = new Watchlist({
        name: newWatchlist.trim(),
        user: userId,
        listings: [listingId],
      });
      await watchlist.save();
    } else if (existingWatchlist && existingWatchlist.trim() !== "") {
      // Add to existing watchlist
      watchlist = await Watchlist.findOne({
        name: existingWatchlist.trim(),
        user: userId,
      });

      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found." });
      }

      // Avoid duplicate entries
      if (!watchlist.listings.includes(listingId)) {
        watchlist.listings.push(listingId);
        await watchlist.save();
      }
    } else {
      return res.status(400).json({ message: "Watchlist name is required." });
    }

    return res
      .status(200)
      .json({ message: "Listing added to watchlist.", watchlist });
  } catch (err) {
    console.error("Error in addToWatchlist:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports.showUserWatchlists = async (req, res) => {
  const watchlists = await Watchlist.find({ user: req.user._id }).populate(
    "listings"
  );
  res.render("watchlist/index", { watchlists });
};

module.exports.removeListing = async (req, res) => {
  try {
    const userId = req.user._id;
    const { listingId } = req.params;
    const { watchlistName } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: "Missing listingId" });
    }

    // If watchlist name is provided → remove from that specific one
    if (watchlistName) {
      const watchlist = await Watchlist.findOne({ user: userId, name: watchlistName });
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      watchlist.listings = watchlist.listings.filter(
        (id) => id.toString() !== listingId.toString()
      );

      if (watchlist.listings.length === 0) {
        await Watchlist.deleteOne({ _id: watchlist._id });
        return res.json({
          message: `Listing removed and watchlist '${watchlistName}' deleted because it became empty.`,
          watchlistDeleted: true,
          watchlistName,
        });
      } else {
        await watchlist.save();
        return res.json({
          message: `Listing removed from watchlist '${watchlistName}'.`,
          watchlistDeleted: false,
          watchlistName,
        });
      }
    }

    // If no watchlist name → remove from all watchlists
    const watchlists = await Watchlist.find({
      user: userId,
      listings: listingId,
    });

    for (let wl of watchlists) {
      wl.listings.pull(listingId);
      if (wl.listings.length === 0) {
        await Watchlist.findByIdAndDelete(wl._id);
      } else {
        await wl.save();
      }
    }

    return res.json({ message: "Listing removed from all watchlists (if existed)." });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to remove listing from watchlist(s)" });
  }
};
