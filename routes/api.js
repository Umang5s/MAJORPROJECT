// routes/api.js
const express = require('express');
const router = express.Router();
const Listing = require('../models/listing');

// GET /api/destinations?q=...
router.get('/destinations', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      // return a few popular places if no query
      return res.json(['Goa, India', 'Mumbai, India', 'New Delhi, India', 'Bengaluru, India']);
    }
    // Try to find distinct locations that match (case-insensitive)
    const results = await Listing.find(
      { location: { $regex: q, $options: 'i' } }
    ).limit(10).distinct('location');

    if (results && results.length) {
      return res.json(results);
    }
    // fallback to return the query itself (so the user can search for typed location)
    res.json([q]);
  } catch (err) {
    console.error('destinations api error', err);
    res.status(500).json([]);
  }
});

module.exports = router;
