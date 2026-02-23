const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');

router.post('/switch', isLoggedIn, (req, res) => {
    const { mode } = req.body;
    
    console.log('Switching mode to:', mode);
    
    if (mode === 'host' || mode === 'traveller') {
        req.session.mode = mode;
    }
    
    // Save session before redirect
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
        }
        
        // Redirect based on mode
        if (mode === 'host') {
            req.flash('success', 'Switched to Host Mode');
            res.redirect('/host/today');
        } else {
            req.flash('success', 'Switched to Traveller Mode');
            res.redirect('/listings');
        }
    });
});

// Debug route to check current mode
router.get('/check', (req, res) => {
    res.json({ 
        mode: req.session.mode || 'traveller',
        authenticated: req.isAuthenticated(),
        userId: req.user?._id
    });
});

module.exports = router;