// File: routes/rides.js
const express = require('express');
const router = express.Router();

const Ride = require('../models/Ride');
const User = require('../models/User');
const transporter = require('../utils/email'); // We need this for the payment receipt!

// 1. GET ALL RIDES
router.get('/rides', async (req, res) => {
    try {
        const rides = await Ride.find().lean();
        
        const driverUsernames = [...new Set(rides.map(r => r.driverUsername))];
        const drivers = await User.find({ username: { $in: driverUsernames } }).lean();
        
        const driverMap = {};
        drivers.forEach(d => driverMap[d.username] = d);

        const enrichedRides = rides.map(ride => {
            const driver = driverMap[ride.driverUsername];
            return {
                ...ride,
                driverRating: driver ? driver.rating : 5.0,
                driverReviews: driver ? driver.reviewCount : 0
            };
        });
        res.json(enrichedRides);
    } catch (err) { res.status(500).json({ error: "Error fetching rides" }); }
});

// 2. SEARCH RIDES
router.get('/rides/search', async (req, res) => {
    try {
        const { to } = req.query; 
        if (!to) return res.json([]);

        const regex = new RegExp(to, 'i');
        const rides = await Ride.find({
            $or: [{ from: regex }, { to: regex }, { stops: { $in: [regex] } }],
            status: 'scheduled', 
            seats: { $gt: 0 }    
        }).lean();

        const driverUsernames = [...new Set(rides.map(r => r.driverUsername))];
        const drivers = await User.find({ username: { $in: driverUsernames } }).lean();
        
        const driverMap = {};
        drivers.forEach(d => driverMap[d.username] = d);

        const enrichedRides = rides.map(ride => {
            const driver = driverMap[ride.driverUsername];
            return { ...ride, driverRating: driver ? driver.rating : 5.0, driverReviews: driver ? driver.reviewCount : 0 };
        });

        res.json(enrichedRides);
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

// 3. POST A NEW RIDE
router.post('/rides', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.driverUsername }).lean();
        if (!user || !user.vehicle || !user.vehicle.isVerified) {
            return res.status(403).json({ error: "⛔ You must have a Verified Vehicle to post rides." });
        }
        const newRide = new Ride(req.body);
        await newRide.save();
        res.status(201).json({ message: "Ride Posted", ride: newRide });
    } catch (err) { res.status(400).json({ error: "Error posting ride" }); }
});

// 4. DELETE A RIDE
router.delete('/rides/:id', async (req, res) => {
    try {
        await Ride.findByIdAndDelete(req.params.id);
        res.json({ message: "Ride Deleted" });
    } catch (err) { res.status(500).json({ error: "Error deleting ride" }); }
});

// 5. UPDATE RIDE STATUS
router.post('/rides/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        let updateData = { status };
        if(status === 'started') updateData.startTime = new Date();
        await Ride.findByIdAndUpdate(req.params.id, updateData);
        res.json({ message: `Ride ${status}` });
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// 6. UPDATE LIVE LOCATION
router.post('/rides/:id/location', async (req, res) => {
    try {
        await Ride.findByIdAndUpdate(req.params.id, { currentLat: req.body.lat, currentLon: req.body.lon });
        res.json({ message: "Location updated" });
    } catch (err) { res.status(500).json({ error: "Error updating location" }); }
});

// 7. GET LIVE LOCATION
router.get('/rides/:id/location', async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id).lean();
        if(!ride) return res.status(404).json({ error: "Ride not found" });
        res.json({ lat: ride.currentLat, lon: ride.currentLon, status: ride.status });
    } catch (err) { res.status(500).json({ error: "Error fetching location" }); }
});

// 8. PAY FOR RIDE
router.post('/rides/:id/pay', async (req, res) => {
    console.log("💰 Payment Request Received:", req.body);
    try {
        const { userEmail, amount } = req.body; 
        const ride = await Ride.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid' }, { new: true });

        const mailOptions = {
            from: process.env.SYSTEM_EMAIL, 
            to: userEmail,
            subject: '🚖 Payment Receipt - SwiftWheels',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">Payment Successful!</h2>
                    <p>Hi there,</p>
                    <p>Thank you for riding with SwiftWheels. Here is your receipt.</p>
                    <table style="width: 100%; margin-top: 20px;">
                        <tr><td><strong>Amount Paid:</strong></td><td>₹${amount}</td></tr>
                        <tr><td><strong>Driver:</strong></td><td>${ride.driver || 'SwiftWheels Driver'}</td></tr>
                        <tr><td><strong>Date:</strong></td><td>${new Date().toDateString()}</td></tr>
                        <tr><td><strong>Status:</strong></td><td style="color:green; font-weight:bold;">PAID via UPI</td></tr>
                    </table>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.error("❌ Email Error:", err);
            else console.log("✅ Receipt sent:", info.response);
        });

        res.json({ message: "Payment Successful & Receipt Sent" });
    } catch (err) { 
        console.error("Payment Route Error:", err);
        res.status(500).json({ error: "Payment failed" }); 
    }
});

module.exports = router;