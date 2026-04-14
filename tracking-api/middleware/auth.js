/**
 * JWT verification middleware for member routes.
 * In development, also accepts x-user-id header as fallback.
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Dev fallback
    if (process.env.NODE_ENV !== 'production' && req.headers['x-user-id']) {
      req.userId = req.headers['x-user-id'];
      return next();
    }
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.sub || decoded._id || decoded.id;
    if (!req.userId) {
      req.userId = decoded.email || 'unknown';
    }
    req.userRoles = decoded.roles || [];
    next();
  } catch (err) {
    // Dev fallback
    if (process.env.NODE_ENV !== 'production' && req.headers['x-user-id']) {
      req.userId = req.headers['x-user-id'];
      return next();
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
