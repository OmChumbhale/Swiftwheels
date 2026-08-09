// File: utils/email.js
/*
const { Resend } = require('resend');

// Get a free API key from https://resend.com
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async (email, otp) => {
    try {
        await resend.emails.send({
            from: 'SwiftWheels <onboarding@resend.dev>', // Free tier uses this domain
            to: email,
            subject: 'SwiftWheels Verification Code',
            html: `<strong>Your OTP is: ${otp}</strong>`
        });
        console.log("✅ Email sent via Resend API");
    } catch (error) {
        console.error("❌ Resend API Error:", error);
    }
};

module.exports = { sendOTP };


const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    // 'pool: true' is CRITICAL for cloud servers. 
    // It keeps the connection open instead of creating a new one for every OTP.
    pool: true, 
    maxConnections: 3,
    maxMessages: 100,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Ensure no spaces here!            
    },
    tls: { 
        rejectUnauthorized: false,
        minVersion: "TLSv1.2" 
    },
    // Increased timeouts to give Render's DNS enough time to resolve Gmail
    connectionTimeout: 20000, 
    greetingTimeout: 20000,
    socketTimeout: 25000
});

// Improved verification with more logging
transporter.verify((error, success) => {
    if (error) {
        console.log("❌ Email Server Error Details:", error.message);
    } else {
        console.log("✅ Email Server is Ready - Cloud Connection Active");
    }
});
*/


// ==========================
// 📧 EMAIL CONFIG
// ==========================

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Explicitly set host
    port: 465,              // Use Port 465 for Secure SSL
    secure: true,           // Must be true for 465
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    },
    tls: {
        rejectUnauthorized: false // Helps avoid some local SSL errors
    }
});

// TEST CONNECTION ON STARTUP
transporter.verify(function (error, success) {
    if (error) {
        console.log("❌ Email Server Error:", error.message);
    } else {
        console.log("✅ Email Server is Ready to Send Messages");
    }
});
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

module.exports = transporter;
