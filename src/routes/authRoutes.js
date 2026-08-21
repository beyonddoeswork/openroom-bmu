const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const User = require('../models/User');
const AccessRequest = require('../models/AccessRequest');
const { verifyToken } = require('../middleware/auth');
const { generateRequestsExcel } = require('../services/excelService');

// Dual Safety Sync: Syncs MongoDB requests to Excel without lock errors
async function syncExcelFile() {
  try {
    const allRequests = await AccessRequest.find().sort({ createdAt: -1 });
    const excelBuffer = generateRequestsExcel(allRequests);
    const filePath = path.join(__dirname, '../../Day_Scholars_Requests.xlsx');

    try {
      fs.writeFileSync(filePath, excelBuffer);
      console.log(`[Excel Sync] ✅ Updated ${filePath}`);
    } catch (writeErr) {
      if (writeErr.code === 'EBUSY') {
        const backupPath = path.join(__dirname, '../../Day_Scholars_Requests_latest.xlsx');
        fs.writeFileSync(backupPath, excelBuffer);
        console.warn(`[Excel Sync Warning] Main Excel file is open. Saved to fallback: ${backupPath}`);
      } else {
        throw writeErr;
      }
    }
  } catch (err) {
    console.error('[Excel Sync Error]:', err.message);
  }
}

// 1. Submit Signup Request
router.post('/request-access', async (req, res) => {
  try {
    const { name, bmuEmail, mobile } = req.body;
    if (!name || !bmuEmail) {
      return res.status(400).json({ success: false, message: 'Name and BMU Email are required.' });
    }

    const cleanEmail = bmuEmail.toLowerCase().trim();
    const existing = await AccessRequest.findOne({ bmuEmail: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A signup request for this BMU email already exists.' });
    }

    const reqDoc = await AccessRequest.create({
      name: name.trim(),
      bmuEmail: cleanEmail,
      mobile: mobile ? mobile.trim() : 'N/A'
    });

    await syncExcelFile();

    res.status(201).json({
      success: true,
      message: 'Your registration request has been submitted to the Admin queue!',
      data: reqDoc
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Registration request failed.' });
  }
});

// 2. Primary Login Route (Handles 2FA Status)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    const cleanInput = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanInput });

    if (!user) {
      const accessReq = await AccessRequest.findOne({ bmuEmail: cleanInput, status: 'approved' });
      if (accessReq && accessReq.provisionedEmail) {
        user = await User.findOne({ email: accessReq.provisionedEmail.toLowerCase().trim() });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Account not found. Please register or contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    // --- ADMIN 2FA FLOW ---
    if (user.role === 'admin') {
      console.log(`[Admin Login Attempt] User: ${user.email} | 2FA Enabled: ${user.twoFactorEnabled} | Has Secret: ${Boolean(user.twoFactorSecret)}`);

      // If 2FA is ALREADY enabled in DB -> Request 6-digit code directly
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        return res.json({
          success: true,
          require2FA: true,
          userId: user._id,
          message: 'Enter 6-digit Authenticator code.'
        });
      }

      // If 2FA is NOT enabled yet -> Reuse existing secret if available or create a new one
      let secretBase32 = user.twoFactorSecret;
      let otpAuthUrl;

      if (!secretBase32) {
        const secret = speakeasy.generateSecret({
          name: `OpenRoom BMU Admin (${user.email})`,
          issuer: 'OpenRoom BMU'
        });
        secretBase32 = secret.base32;
        otpAuthUrl = secret.otpauth_url;

        // Save secret to database immediately
        user.twoFactorSecret = secretBase32;
        user.twoFactorEnabled = false;
        await user.save();
      } else {
        otpAuthUrl = speakeasy.otpauthURL({
          secret: secretBase32,
          label: `OpenRoom BMU Admin (${user.email})`,
          issuer: 'OpenRoom BMU',
          encoding: 'base32'
        });
      }

      const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

      return res.json({
        success: true,
        require2FASetup: true,
        userId: user._id,
        qrCode: qrCodeUrl,
        manualKey: secretBase32,
        message: 'Scan QR code with Google Authenticator.'
      });
    }

    // Standard Student Token Issue
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'bmu_openroom_jwt_super_production_secret_key_2026_secure',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        branch: user.branch || 'B.Tech CSE',
        batchYear: user.batchYear || '2026',
        avatarColor: user.avatarColor || '#118A5E',
        bio: user.bio || 'BMU Day Scholar'
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// 3. Verify 2FA & Lock Activation in MongoDB
router.post('/verify-2fa', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ success: false, message: 'User ID and 6-digit code are required.' });
    }

    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA session expired. Please log in again.' });
    }

    // Validate TOTP code with time-drift allowance
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code.trim(),
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ success: false, message: 'Invalid 6-digit Authenticator code.' });
    }

    // 3b. Admin Emergency 2FA Reset (Self-Service Recovery)
router.post('/reset-2fa-emergency', async (req, res) => {
  try {
    const { email, password, recoveryKey } = req.body;
    if (!email || !password || !recoveryKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin email, password, and Master Recovery Key are required.' 
      });
    }

    const masterKey = process.env.ADMIN_RECOVERY_KEY || 'BMU_OPENROOM_EMERGENCY_2FA_RESET_2026!';
    if (recoveryKey.trim() !== masterKey.trim()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Master Recovery Key.' 
      });
    }

    const cleanInput = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanInput, role: 'admin' });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Administrator account not found.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect admin password.' 
      });
    }

    // Reset 2FA status in database
    user.twoFactorSecret = null;
    user.twoFactorEnabled = false;
    await user.save();

    console.log(`[Emergency Recovery] ⚠️ 2FA has been cleared for admin: ${user.email}. New setup will be requested on next login.`);

    res.json({
      success: true,
      message: '2FA has been successfully reset! Please sign in again to set up a new Google Authenticator QR code.'
    });
  } catch (err) {
    console.error('Emergency 2FA Reset Error:', err);
    res.status(500).json({ success: false, message: 'Failed to process 2FA recovery.' });
  }
});

    // Mark 2FA as ENABLED permanently in MongoDB Atlas
    user.twoFactorEnabled = true;
    await user.save();
    console.log(`[2FA Activated] ✅ 2FA permanently locked in DB for ${user.email}`);

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'bmu_openroom_jwt_super_production_secret_key_2026_secure',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        branch: user.branch || 'Administration',
        batchYear: user.batchYear || 'Staff',
        avatarColor: user.avatarColor || '#131D35',
        bio: user.bio || 'Official OpenRoom Administrator'
      }
    });
  } catch (err) {
    console.error('2FA Verification Error:', err);
    res.status(500).json({ success: false, message: '2FA verification error.' });
  }
});

// 4. Get Current User Profile (Live from DB)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -twoFactorSecret');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        branch: user.branch || 'B.Tech CSE',
        batchYear: user.batchYear || '2026',
        avatarColor: user.avatarColor || '#118A5E',
        bio: user.bio || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile data.' });
  }
});

// 5. Update Profile Customization
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, mobile, branch, batchYear, avatarColor, bio } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name && name.trim()) user.name = name.trim();
    if (mobile !== undefined) user.mobile = mobile ? mobile.trim() : 'N/A';
    if (branch) user.branch = branch.trim();
    if (batchYear) user.batchYear = batchYear.trim();
    if (avatarColor) user.avatarColor = avatarColor;
    if (bio !== undefined) user.bio = bio.trim();

    await user.save();

    await AccessRequest.findOneAndUpdate(
      { provisionedEmail: user.email },
      { name: user.name, mobile: user.mobile }
    );
    await syncExcelFile();

    res.json({
      success: true,
      message: 'Profile details updated and synced across MongoDB & Excel!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        branch: user.branch,
        batchYear: user.batchYear,
        avatarColor: user.avatarColor,
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('[Profile Update Error]:', err);
    res.status(500).json({ success: false, message: 'Profile update failed.' });
  }
});

// 6. Change Password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, alreadyPass } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await AccessRequest.findOneAndUpdate(
      { provisionedEmail: user.email },
      { temporaryPassword: newPassword }
    );
    await syncExcelFile();

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password update failed.' });
  }
});

module.exports = router;