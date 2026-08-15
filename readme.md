# 🏫 OpenRoom BMU — Campus Study Spot & Live Classroom Finder

> **Real-time classroom availability, day scholar access management, study pod tracking, and campus crowdsourcing built specifically for BML Munjal University.**

---

## 📌 Project Overview

**OpenRoom BMU** is a single-page application (SPA) engineered to solve study-space discovery for day scholars and students across the BMU campus. It tracks live room statuses across all primary campus blocks, provides an admin-moderated access request pipeline, supports dynamic profile customization, and delivers crowdsourced verification with automated suggestions.

---

## ✨ Core Features

### 🔍 Live Campus Room Directory
* **Real-time Availability:** Categorized tracking across **Block A**, **Block B**, **Block C**, **Central Library**, and the **Innovation Hub**.
* **Smart Filtering:** Filter instantly by building, search keyword, capacity, or current status (`empty` vs. `occupied`).
* **90-Minute Auto-Reset:** Room occupancy states dynamically expire to avoid stale status indicators.
* **Crowdsourced "I Am Walking" Arrival Verification:** Students confirm room availability upon arrival or flag makeup lectures to instantly reroute peers to nearby alternative rooms.

### 🛡️ Secure Day Scholar & Admin Authentication
* **Day Scholar Provisioning:** Students request access using their official `@bmu.edu.in` email and receive admin-assigned `@openroom.xyz` credentials.
* **Two-Factor Authentication (2FA) for Admins:** Google Authenticator integration (TOTP) with QR code setup and manual fallback key support.
* **Emergency 2FA Recovery:** Self-service emergency recovery system using an environment-locked `ADMIN_RECOVERY_KEY` or direct terminal CLI recovery via `node reset-admin-2fa.js`.

### 👤 Student Profile Customization
* Interactive avatar theme accent pickers with live palette selection.
* Customizable branch, graduation batch year, and campus status bio.
* Dynamic persistence directly synchronized with MongoDB Atlas.

### 💬 Community Ideas & Spot Reviews
* Day scholars can submit feature requests or review study environments.
* **Official Administrator Responses:** Direct replies highlighted with administrator verification badges.
* **1-Hour Auto-Purge Lifecycle:** Admins can flag suggestions as *Noted* with automatic cleanup routines.

### ⚡ Administrator Operations Center
* Full CRUD control over campus rooms (capacity, type, floor, building).
* Interactive table with live status toggling and keyword search.
* Single-click credential provisioning for new signup requests.
* **Automated Excel Synchronization:** Dual-sync system that writes real-time student records to `Day_Scholars_Requests.xlsx` with automatic fallback handling.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas (Mongoose ODM) with automated embedded in-memory failover (`mongodb-memory-server`)
* **Security & Auth:** JSON Web Tokens (JWT), Bcrypt.js, Speakeasy (TOTP), QRCode
* **Spreadsheet Sync:** SheetJS (`xlsx`)
* **Frontend:** Vanilla JavaScript (SPA Hash Router), HTML5, Custom Design System CSS

---

## 📂 Project Structure

```text
openroom/
├── public/
│   ├── css/
│   │   └── styles.css          # Core design tokens, layout & responsive styling
│   ├── js/
│   │   └── app.js              # SPA router, state store, UI renderers & API client
│   └── index.html              # Single-page application entry point
├── src/
│   ├── config/
│   │   └── db.js               # MongoDB Atlas connection & admin seeder
│   ├── middleware/
│   │   └── auth.js             # JWT verification & role authorization
│   ├── models/
│   │   ├── AccessRequest.js    # Day scholar signup request schema
│   │   ├── Review.js           # Community reviews & admin replies schema
│   │   ├── Room.js             # Campus room specifications & status schema
│   │   └── User.js             # Student and admin user schema
│   ├── routes/
│   │   ├── adminRoutes.js      # Provisioning, Excel exports & overview routes
│   │   ├── authRoutes.js       # Auth, 2FA, password management & profile routes
│   │   ├── reviewRoutes.js     # Feedback posting, admin replies & note actions
│   │   └── roomRoutes.js       # Live room matrix, status updates & reports
│   └── services/
│       └── excelService.js     # Excel generation & request roster formatting
├── .env.example                # Template for environment variables
├── .gitignore                  # Git untracked files and secrets list
├── package.json                # Project dependencies and script definitions
├── reset-admin-2fa.js          # CLI utility for emergency admin 2FA resets
└── server.js                   # Express application initialization & middleware