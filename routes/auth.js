// File: routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Notice the '../' to go up one folder
const transporter = require('../utils/email'); // Import our new email utility

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


router.post('/register', async (req, res) => {
    try {
        const { fullName, username, password, email } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] }).lean();
        if (existingUser) return res.status(400).json({ error: "User or Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const isAdmin = username.toLowerCase() === 'admin';

        const newUser = new User({ 
            fullName, username, email, password: hashedPassword, 
            otp, otpExpires: Date.now() + 600000, isVerified: false, isAdmin 
        });
        
        await newUser.save();
        
        try {
            await transporter.sendMail({
                to: email, subject: 'Verify SwiftWheels', text: `Your OTP is: ${otp}`
            });
            res.status(201).json({ message: "OTP sent!" });
        } catch (mailError) {
            // ✅ FIX: If email fails, don't crash. Send the OTP back to the frontend in Demo Mode.
            console.log(`⚠️ [RENDER BYPASS] OTP for ${email} is: ${otp}`);
            res.status(200).json({
                isDemo: true,
                message: `Demo Mode: Email restricted. Your OTP is ${otp}`,
                otp: otp 
            });
        }
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});
/*
// 1. REGISTER
router.post('/register', async (req, res) => {
    try {
        const { fullName, username, password, email } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] }).lean();
        if (existingUser) return res.status(400).json({ error: "User or Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const isAdmin = username.toLowerCase() === 'admin';

        const newUser = new User({ 
            fullName, username, email, password: hashedPassword, 
            otp, otpExpires: Date.now() + 600000, isVerified: false, isAdmin 
        });
        
        await newUser.save();
        
        try
        {
            await transporter.sendMail({
                to: email, subject: 'Verify SwiftWheels', text: `Your OTP is: ${otp}`
            });
            res.status(201).json({ message: "OTP sent!" });
        }
        catch (mailError) {
            // 3. THE BYPASS: This runs if Render blocks the email
            console.log(`⚠️ [RENDER BYPASS] OTP for ${email} is: ${otp}`);

            res.status(200).json({
                success: true,
                isDemo: true,
                message: `Demo Mode: Email restricted on Free Tier. Your OTP is ${otp}`,
                otp: otp // Sending it back so the frontend can auto-fill or show it
            });
        }

        
        
    } catch (err) { res.status(500).json({ error: err.message }); }
});
*/
// 2. VERIFY OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });

        user.isVerified = true; user.otp = undefined;
        await user.save();
        res.json({ message: "Verified!" });
    } catch (err) { res.status(500).json({ error: "Error verifying" }); }
});

// 3. LOGIN
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username }).lean();
        if (!user || !user.isVerified) return res.status(400).json({ error: "Invalid User or Unverified" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Wrong Password" });

        res.json({ 
            message: "Login Success", 
            user: { username: user.username, fullName: user.fullName, isAdmin: user.isAdmin, phone: user.phone } 
        });
    } catch (err) { res.status(500).json({ error: "Login failed" }); }
});

module.exports = router;