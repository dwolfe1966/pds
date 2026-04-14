/**
 * Admin key verification middleware.
 */

const ADMIN_KEY = process.env.TRACKING_ADMIN_KEY || 'dev-admin-key';

module.exports = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
