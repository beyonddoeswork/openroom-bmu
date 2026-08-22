const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bmu_openroom_jwt_super_production_secret_key_2026_secure');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator rights required.' });
    }
  });
};

// Allows optional student context without rejecting unauthenticated guests
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bmu_openroom_jwt_super_production_secret_key_2026_secure');
    req.user = decoded;
  } catch (err) {
    // Continue without req.user if token is expired or invalid
  }
  next();
};

module.exports = { verifyToken, verifyAdmin, optionalAuth };