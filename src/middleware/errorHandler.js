/**
 * Global Production Error Handling Middleware
 * Prevents server crashes, sanitizes error logs, and delivers clean JSON responses.
 */

// 404 Not Found Middleware (For API Routes)
const notFoundHandler = (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }
  next();
};

// Global Centralized Error Handler
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose / MongoDB Duplicate Key Error (e.g. unique email or room code)
  if (err.code === 11000) {
    statusCode = 400;
    const duplicateField = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${duplicateField} already exists.`;
  }

  // Handle Mongoose Schema Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // Handle JWT Malformed / Expired Tokens
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please sign in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please sign in again.';
  }

  // Log in development/server console (hidden from end-user response for security)
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[Error ${statusCode}] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { notFoundHandler, errorHandler };