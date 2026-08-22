const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Room = require('../models/Room');
const Report = require('../models/Report');
const AccessRequest = require('../models/AccessRequest');
const PasswordReset = require('../models/PasswordReset');
const { verifyAdmin } = require('../middleware/auth');
const { generateRequestsExcel } = require('../services/excelService');

// Safe Excel writer with EBUSY lock detection
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
        console.warn(`[Excel Sync Warning] 'Day_Scholars_Requests.xlsx' is open in Excel. Saved update to 'Day_Scholars_Requests_latest.xlsx' instead.`);
      } else {
        throw writeErr;
      }
    }
  } catch (err) {
    console.error('[Excel Sync Error]:', err.message);
  }
}

// 1. Admin Overview (Includes Password Reset Alerts)
router.get('/overview', verifyAdmin, async (req, res) => {
  try {
    const [totalRooms, emptyRooms, totalReports, requests, reports, resetAlerts] = await Promise.all([
      Room.countDocuments(),
      Room.countDocuments({ status: 'empty' }),
      Report.countDocuments(),
      AccessRequest.find().sort({ createdAt: -1 }),
      Report.find().sort({ reportedAt: -1 }).limit(10),
      PasswordReset.find({ status: 'pending' }).sort({ requestedAt: -1 })
    ]);

    res.json({
      success: true,
      stats: {
        totalRooms,
        emptyRooms,
        occupiedRooms: totalRooms - emptyRooms,
        totalReports,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        pendingResets: resetAlerts.length
      },
      requests,
      reports,
      resetAlerts
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin overview.' });
  }
});

// 2. Resolve / Mark Password Reset Ticket Done
router.post('/resolve-password-reset', verifyAdmin, async (req, res) => {
  try {
    const { resetId } = req.body;
    if (!resetId) {
      return res.status(400).json({ success: false, message: 'Reset ID is required.' });
    }

    await PasswordReset.findByIdAndUpdate(resetId, {
      status: 'resolved',
      resolvedAt: new Date()
    });

    res.json({ success: true, message: 'Password reset ticket marked as resolved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to resolve reset ticket.' });
  }
});

// 3. Export Excel (.xlsx) Download
router.get('/export-excel', verifyAdmin, async (req, res) => {
  try {
    const requests = await AccessRequest.find().sort({ createdAt: -1 });
    const buffer = generateRequestsExcel(requests);

    res.setHeader('Content-Disposition', 'attachment; filename="BMU_DayScholars_Requests.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Excel export error.' });
  }
});

// 4. Admin: Provision User with Custom Email & Password
router.post('/provision-user', verifyAdmin, async (req, res) => {
  try {
    const { requestId, name, customEmail, password, mobile } = req.body;
    if (!name || !customEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, custom login email, and password are required.' });
    }

    const cleanEmail = customEmail.toLowerCase().trim();

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: `An account with ${cleanEmail} already exists.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: 'student',
      mobile: mobile || 'N/A'
    });

    if (requestId) {
      await AccessRequest.findByIdAndUpdate(requestId, {
        status: 'approved',
        provisionedEmail: cleanEmail,
        temporaryPassword: password
      });
    }

    await syncExcelFile();

    res.status(201).json({
      success: true,
      message: `Account created: ${cleanEmail}`,
      credentials: { email: cleanEmail, password }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to provision account.' });
  }
});

// 5. Admin: Reset/Change Student Password or Email Manually
router.post('/reset-student-password', verifyAdmin, async (req, res) => {
  try {
    const { requestId, newPassword, newEmail } = req.body;
    if (!requestId || !newPassword) {
      return res.status(400).json({ success: false, message: 'Request ID and new password are required.' });
    }

    const reqDoc = await AccessRequest.findById(requestId);
    if (!reqDoc) {
      return res.status(404).json({ success: false, message: 'Student request record not found.' });
    }

    const oldEmail = reqDoc.provisionedEmail;
    const targetEmail = (newEmail || oldEmail).toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (oldEmail) {
      await User.findOneAndUpdate(
        { email: oldEmail },
        { email: targetEmail, password: hashedPassword }
      );
    } else {
      await User.create({
        name: reqDoc.name,
        email: targetEmail,
        password: hashedPassword,
        role: 'student',
        mobile: reqDoc.mobile
      });
    }

    reqDoc.status = 'approved';
    reqDoc.provisionedEmail = targetEmail;
    reqDoc.temporaryPassword = newPassword;
    await reqDoc.save();

    await syncExcelFile();

    res.json({
      success: true,
      message: `Credentials updated for ${reqDoc.name}! Password saved in Excel.`,
      credentials: { email: targetEmail, password: newPassword }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset student password.' });
  }
});

module.exports = router;