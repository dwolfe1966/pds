/**
 * GET /health — liveness check
 */

const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  const db = require('../db');
  let eventCount = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM events').get();
    eventCount = row.cnt;
  } catch (e) {
    eventCount = -1;
  }
  res.json({ status: 'ok', ts: new Date().toISOString(), events: eventCount });
});

module.exports = router;
