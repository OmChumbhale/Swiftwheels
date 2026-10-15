# 🚗 SwiftWheels | Smart Urban Carpooling Platform

![Project Status](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Tech Stack](https://img.shields.io/badge/Stack-MERN-yellow)

**SwiftWheels** is a full-stack web application designed to solve urban traffic congestion through efficient carpooling. It connects daily commuters with verified drivers, featuring real-time route optimization, secure email notifications, and an administrative dashboard for safety monitoring.

---

## 🌟 Key Features

### 🚦 Core Functionality
- **Smart Ride Matching**: Algorithms to match passengers with drivers going the same way.
- **Live Route Tracking**: Integration with **Leaflet.js** and **OSRM** for real-time maps and turn-by-turn navigation.
- **Ride Scheduling**: Users can book rides in advance or find instant matches.

### 🛡️ Security & Trust
- **Dual-Authentication**: Secure login system with hashed passwords (Bcrypt).
- **Verified Drivers**: Admin approval required for all driver accounts.
- **Instant Alerts**: Automated email confirmations for bookings, OTPs, and ride status updates using **Nodemailer**.

### 💻 Admin Dashboard
- Centralized control panel to view all users, approve drivers, and monitor active rides.

---

## 🛠️ Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Glassmorphism UI), JavaScript (ES6+), Bootstrap 5 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Atlas Cloud), Mongoose ODM |
| **APIs & Maps** | OpenStreetMap, Leaflet.js, OSRM (Open Source Routing Machine) |
| **Utilities** | Nodemailer (Email), Bcrypt (Security), Dotenv (Config) |

---

## 🚀 Installation & Setup

Follow these steps to run the project locally on your machine.

### 1. Clone the Repository
```bash
git clone [https://github.com/OmChumbhale/Swiftwheels](https://github.com/OmChumbhale/Swiftwheels)
cd SwiftWheels
```
2. Install Dependencies
Bash
npm install

3. Configure Environment Variables
Create a file named .env in the root directory. Add the following credentials:

Code snippet
# Server Configuration
PORT=3000

# Database Connection (MongoDB Atlas)
MONGO_URI=your_mongodb_connection_string

# Email Service (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Application Settings
SYSTEM_EMAIL="SwiftWheels <your_email@gmail.com>"
ADMIN_EMAIL=your_admin_email@gmail.com
SESSION_SECRET=your_random_secret_key

4. Run the Server
Bash
# Start the application
node server.js
Visit http://localhost:3000 in your browser to see the app live.

## Deploy on Vercel

1. Import this GitHub repository in Vercel and use the repository root as the project root.
2. Add these environment variables in **Project Settings → Environment Variables**:
	- `MONGO_URI`
	- `EMAIL_USER`
	- `EMAIL_PASS`
	- `ADMIN_EMAIL`
	- `SYSTEM_EMAIL`
3. In MongoDB Atlas, allow connections from Vercel and ensure the database user has the required permissions.
4. Deploy or redeploy the project. Do not add `.env` to GitHub; enter secrets only in Vercel's environment-variable settings.

SwiftWheels/
├── models/             # Mongoose Database Schemas (User, Ride, Booking)
├── public/             # Static Assets (HTML, CSS, Client-side JS) # Frontend logic (Map integration, Forms)
│   ├── index.html         
├── admin.html     
├── server.js           # Main Express App & Route Handlers
├── .env                # Environment Variables (Not pushed to Git)
├── .gitignore          # Files to ignore (node_modules, .env)
└── README.md           # Project Documentation

