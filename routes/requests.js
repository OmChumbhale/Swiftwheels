// File: routes/requests.js
const express = require('express');
const router = express.Router();

const Request = require('../models/Request');
const User = require('../models/User');
const Ride = require('../models/Ride');

router.post('/requests', async (req, res) => {
    try {
        const { rideId, passenger, driver, rideDetails, pickupPoint } = req.body;
        const userObj = await User.findOne({ username: passenger }).lean();
        const passengerPhone = userObj ? userObj.phone : "Not set";

        const newReq = new Request({ rideId, passenger, driver, rideDetails, passengerPhone, pickupPoint });
        await newReq.save();
        res.status(201).json({ message: "Request Sent" });
    } catch (err) { res.status(400).json({ error: "Error requesting" }); }
});

router.get('/requests/driver/:username', async (req, res) => {
    try {
        const requests = await Request.find({ driver: req.params.username, status: 'pending' }).lean();
        res.json(requests);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.get('/requests/passenger/:username', async (req, res) => {
    try {
        const requests = await Request.find({ passenger: req.params.username }).lean();
        res.json(requests);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.post('/requests/:id/:action', async (req, res) => {
    try {
        const { id, action } = req.params;
        const reqItem = await Request.findById(id);
        if (!reqItem) return res.status(404).json({ error: "Not found" });

        if (action === 'reject') {
            reqItem.status = 'rejected';
            await reqItem.save();
            return res.json({ message: "Rejected" });
        }

        if (action === 'accept') {
            const ride = await Ride.findById(reqItem.rideId);
            if (!ride || ride.seats <= 0) return res.status(400).json({ error: "Full" });

            const dUser = await User.findOne({ username: reqItem.driver }).lean();
            ride.seats -= 1;
            await ride.save();

            reqItem.status = 'accepted';
            reqItem.driverPhone = dUser ? dUser.phone : "Not set"; 
            await reqItem.save();
            return res.json({ message: "Accepted" });
        }
    } catch (err) { res.status(500).json({ error: "Action failed" }); }
});

router.post('/requests/:id/cancel', async (req, res) => {
    try {
        const reqItem = await Request.findById(req.params.id);
        if (reqItem.status === 'accepted') {
            const ride = await Ride.findById(reqItem.rideId);
            if(ride) { ride.seats += 1; await ride.save(); }
        }
        reqItem.status = 'cancelled';
        await reqItem.save();
        res.json({ message: "Cancelled" });
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

module.exports = router;