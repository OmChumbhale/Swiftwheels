// File: routes/admin.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Ride = require('../models/Ride');
const Request = require('../models/Request');

// 🛑 THE BOUNCER (Middleware)
// This function runs BEFORE any of the admin routes below.
const verifyAdmin = async (req, res, next) => {
    try {
        // We will make the frontend send the username in the headers
        const username = req.headers['x-admin-username']; 
        
        if (!username) {
            return res.status(401).json({ error: "Access Denied: Who are you?" });
        }

        const user = await User.findOne({ username });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: "Access Denied: Admins Only!" });
        }

        next(); // ID checks out. Let them into the club!
    } catch (err) {
        res.status(500).json({ error: "Server Error during authentication" });
    }
};

// Apply the Bouncer to all routes in this file
// Notice how we put `verifyAdmin` in the middle!

router.post('/admin/verify-vehicle', verifyAdmin, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if(!user) return res.status(404).json({ error: "User not found" });
        user.vehicle.isVerified = true;
        await user.save();
        res.json({ message: "Vehicle Approved!" });
    } catch (err) { res.status(500).json({ error: "Error verifying" }); }
});

router.post('/admin/reject-vehicle', verifyAdmin, async (req, res) => {
    try {
        await User.findOneAndUpdate(
            { username: req.body.username },
            { vehicle: { model: "", plateNumber: "", isVerified: false } }
        );
        res.json({ message: "Vehicle Rejected & Reset" });
    } catch (err) { res.status(500).json({ error: "Error rejecting" }); }
});

router.get('/admin/stats', verifyAdmin, async (req, res) => {
    try {
        const [userCount, rideCount, reqCount] = await Promise.all([
            User.countDocuments(), Ride.countDocuments(), Request.countDocuments()
        ]);
        res.json({ userCount, rideCount, reqCount });
    } catch (err) { res.status(500).json({ error: "Stats error" }); }
});

router.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password -otp').lean();
        res.json(users);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

router.delete('/admin/users/:id', verifyAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Ride.deleteMany({ driver: { $ne: null } }); 
        res.json({ message: "User Banned" });
    } catch (err) { res.status(500).json({ error: "Delete error" }); }
});

module.exports = router;