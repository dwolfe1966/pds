/**
 * Watchers routes — WSFY (Who Searched For You) + WVMP (Who Viewed My Profile)
 *
 * GET  /api/v1/me/watchers/searchers
 * GET  /api/v1/me/watchers/viewers
 * GET  /api/v1/me/watchers/stats
 * POST /api/v1/profile-searches  (write endpoint)
 * POST /api/v1/profile-views     (write endpoint)
 */

const { Router } = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const router = Router();

// ── Searchers ────────────────────────────────────────────────────────────────

router.get('/searchers', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { from, to, limit = 50, cursor, sort = 'desc', tier, searchType } = req.query;

  let query = 'SELECT * FROM profile_searches WHERE target_user_id = ?';
  const params = [userId];

  if (from) { query += ' AND created_at >= ?'; params.push(from); }
  if (to) { query += ' AND created_at <= ?'; params.push(to); }
  if (tier) { query += ' AND searcher_tier = ?'; params.push(tier); }
  if (searchType) { query += ' AND search_type = ?'; params.push(searchType); }
  if (cursor) { query += ` AND id ${sort === 'asc' ? '>' : '<'} ?`; params.push(cursor); }

  query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`;
  params.push(Number(limit) + 1); // fetch one extra for noMoreDocs

  const rows = db.prepare(query).all(...params);
  const noMoreDocs = rows.length <= Number(limit);
  const docs = rows.slice(0, Number(limit));
  const nextCursor = docs.length > 0 ? docs[docs.length - 1].id : null;

  res.json({ docs, noMoreDocs, nextCursor });
});

// ── Viewers ──────────────────────────────────────────────────────────────────

router.get('/viewers', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { from, to, limit = 50, cursor, sort = 'desc', tier } = req.query;

  let query = 'SELECT * FROM profile_views WHERE target_user_id = ?';
  const params = [userId];

  if (from) { query += ' AND created_at >= ?'; params.push(from); }
  if (to) { query += ' AND created_at <= ?'; params.push(to); }
  if (tier) { query += ' AND viewer_tier = ?'; params.push(tier); }
  if (cursor) { query += ` AND id ${sort === 'asc' ? '>' : '<'} ?`; params.push(cursor); }

  query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`;
  params.push(Number(limit) + 1);

  const rows = db.prepare(query).all(...params).map(r => ({
    ...r,
    sections_viewed: r.sections_viewed ? JSON.parse(r.sections_viewed) : [],
  }));
  const noMoreDocs = rows.length <= Number(limit);
  const docs = rows.slice(0, Number(limit));
  const nextCursor = docs.length > 0 ? docs[docs.length - 1].id : null;

  res.json({ docs, noMoreDocs, nextCursor });
});

// ── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const period = req.query.period || '30d';

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const dayOfWeek = now.getDay();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - dayOfWeek);
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  function countRows(table, userId, from, to) {
    let q = `SELECT COUNT(*) as cnt FROM ${table} WHERE target_user_id = ?`;
    const p = [userId];
    if (from) { q += ' AND created_at >= ?'; p.push(from); }
    if (to) { q += ' AND created_at <= ?'; p.push(to); }
    return db.prepare(q).get(...p).cnt;
  }

  function byColumn(table, column, userId) {
    return db.prepare(
      `SELECT ${column} as key, COUNT(*) as count FROM ${table} WHERE target_user_id = ? GROUP BY ${column}`
    ).all(userId).reduce((acc, r) => { acc[r.key || 'unknown'] = r.count; return acc; }, {});
  }

  function dailyTrend(table, userId, days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return db.prepare(
      `SELECT substr(created_at, 1, 10) as date, COUNT(*) as count FROM ${table}
       WHERE target_user_id = ? AND created_at >= ? GROUP BY date ORDER BY date`
    ).all(userId, cutoff);
  }

  const daysNum = parseInt(period) || 30;

  const searchers = {
    total: countRows('profile_searches', userId),
    thisMonth: countRows('profile_searches', userId, thisMonthStart),
    lastMonth: countRows('profile_searches', userId, lastMonthStart, lastMonthEnd),
    thisWeek: countRows('profile_searches', userId, thisWeekStart.toISOString()),
    lastWeek: countRows('profile_searches', userId, lastWeekStart.toISOString(), lastWeekEnd.toISOString()),
    byType: byColumn('profile_searches', 'search_type', userId),
    byTier: byColumn('profile_searches', 'searcher_tier', userId),
    trend: dailyTrend('profile_searches', userId, daysNum),
  };

  const viewers = {
    total: countRows('profile_views', userId),
    thisMonth: countRows('profile_views', userId, thisMonthStart),
    lastMonth: countRows('profile_views', userId, lastMonthStart, lastMonthEnd),
    thisWeek: countRows('profile_views', userId, thisWeekStart.toISOString()),
    lastWeek: countRows('profile_views', userId, lastWeekStart.toISOString(), lastWeekEnd.toISOString()),
    byTier: byColumn('profile_views', 'viewer_tier', userId),
    trend: dailyTrend('profile_views', userId, daysNum),
  };

  res.json({ searchers, viewers });
});

// ── Write endpoints (mounted separately) ────────────────────────────────────

router.postProfileView = (req, res) => {
  const db = require('../db');
  const { targetUserId, targetCommerceContentId, sectionsViewed, source,
    viewerFirstName, viewerLastInitial, viewerCity, viewerState, viewerTier } = req.body;

  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const row = {
    id: crypto.randomUUID(),
    target_user_id: targetUserId,
    viewer_first_name: viewerFirstName || 'Anonymous',
    viewer_last_initial: viewerLastInitial || '',
    viewer_city: viewerCity || null,
    viewer_state: viewerState || null,
    viewer_tier: viewerTier || 'basic',
    sections_viewed: sectionsViewed ? JSON.stringify(sectionsViewed) : '[]',
    sections_count: Array.isArray(sectionsViewed) ? sectionsViewed.length : 0,
    duration_seconds: 0,
    source: source || null,
    created_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO profile_views (id, target_user_id, viewer_first_name, viewer_last_initial,
      viewer_city, viewer_state, viewer_tier, sections_viewed, sections_count,
      duration_seconds, source, created_at)
    VALUES (@id, @target_user_id, @viewer_first_name, @viewer_last_initial,
      @viewer_city, @viewer_state, @viewer_tier, @sections_viewed, @sections_count,
      @duration_seconds, @source, @created_at)
  `).run(row);

  res.status(201).json({ ok: true, id: row.id });
};

router.postProfileSearch = (req, res) => {
  const db = require('../db');
  const { searchType, query, matchedTargetUserIds,
    searcherFirstName, searcherLastInitial, searcherCity, searcherState, searcherTier } = req.body;

  if (!matchedTargetUserIds || !Array.isArray(matchedTargetUserIds)) {
    return res.status(400).json({ error: 'matchedTargetUserIds (array) required' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO profile_searches (id, target_user_id, searcher_first_name, searcher_last_initial,
      searcher_city, searcher_state, searcher_tier, search_type, matched, created_at)
    VALUES (@id, @target_user_id, @searcher_first_name, @searcher_last_initial,
      @searcher_city, @searcher_state, @searcher_tier, @search_type, @matched, @created_at)
  `);

  const ids = [];
  const insertMany = db.transaction((targets) => {
    for (const targetId of targets) {
      const row = {
        id: crypto.randomUUID(),
        target_user_id: targetId,
        searcher_first_name: searcherFirstName || 'Unknown',
        searcher_last_initial: searcherLastInitial || '',
        searcher_city: searcherCity || null,
        searcher_state: searcherState || null,
        searcher_tier: searcherTier || 'basic',
        search_type: searchType || 'name',
        matched: 1,
        created_at: new Date().toISOString(),
      };
      insertStmt.run(row);
      ids.push(row.id);
    }
  });

  insertMany(matchedTargetUserIds);
  res.status(201).json({ ok: true, count: ids.length, ids });
};

module.exports = router;
