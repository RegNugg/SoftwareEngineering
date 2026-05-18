const express = require('express');
const router = express.Router();
const db = require('../db');
const { updateTodayStats } = require('../helpers/stats');

router.get('/:id/queue', (req, res) => {
  const { id } = req.params;
  const rows = db.prepare(`
    SELECT q.id, q.shop_id AS shopId, q.user_id AS userId, u.name AS userName,
           q.position, q.status, q.joined_at AS joinedAt, q.called_at AS calledAt
    FROM queue_entries q
    LEFT JOIN users u ON q.user_id = u.id
    WHERE q.shop_id = ?
    ORDER BY q.position ASC
  `).all(id);
  res.json(rows);
});

router.get('/:id/queue/my-entry', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  const row = db.prepare(`
    SELECT q.id, q.shop_id AS shopId, q.user_id AS userId, u.name AS userName,
           q.position, q.status, q.joined_at AS joinedAt, q.called_at AS calledAt
    FROM queue_entries q
    LEFT JOIN users u ON q.user_id = u.id
    WHERE q.shop_id = ? AND q.user_id = ? AND q.status IN ('waiting', 'called')
  `).get(id, userId);
  res.json(row || null);
});

router.post('/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const row = db.prepare(`SELECT MAX(position) AS maxPos FROM queue_entries WHERE shop_id = ? AND status = 'waiting'`).get(id);
  const nextPosition = (row?.maxPos || 0) + 1;
  const entryId = `${id}-entry-${Date.now()}`;

  db.prepare(
    `INSERT INTO queue_entries (id, shop_id, user_id, position, status) VALUES (?, ?, ?, ?, 'waiting')`
  ).run(entryId, id, userId, nextPosition);
  updateTodayStats(db, id);
  res.json({ id: entryId, shopId: id, userId, position: nextPosition, status: 'waiting' });
});

router.post('/:id/leave', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const entry = db.prepare(`SELECT position FROM queue_entries WHERE shop_id = ? AND user_id = ? AND status = 'waiting'`).get(id, userId);
  if (!entry) {
    return res.status(404).json({ error: 'Queue entry not found' });
  }

  const userPosition = entry.position;
  db.prepare(`UPDATE queue_entries SET status = 'cancelled' WHERE shop_id = ? AND user_id = ? AND status = 'waiting'`).run(id, userId);
  db.prepare(`UPDATE queue_entries SET position = position - 1 WHERE shop_id = ? AND position > ? AND status = 'waiting'`).run(id, userPosition);
  updateTodayStats(db, id);
  res.json({ success: true });
});

router.post('/:id/call-next', (req, res) => {
  const { id } = req.params;

  const entry = db.prepare(`
    SELECT * FROM queue_entries
    WHERE shop_id = ? AND status = 'waiting'
    ORDER BY position ASC
    LIMIT 1
  `).get(id);

  if (!entry) {
    return res.status(404).json({ error: 'No waiting entries in queue' });
  }

  db.prepare(`UPDATE queue_entries SET status = 'called', called_at = datetime('now') WHERE id = ?`).run(entry.id);
  updateTodayStats(db, id);
  res.json({ id: entry.id, shopId: entry.shop_id, userId: entry.user_id, position: entry.position, status: 'called' });
});

router.post('/:id/attend', (req, res) => {
  const { id } = req.params;

  const entry = db.prepare(`
    SELECT * FROM queue_entries
    WHERE shop_id = ? AND status = 'called'
    ORDER BY position ASC
    LIMIT 1
  `).get(id);

  if (!entry) {
    return res.status(404).json({ error: 'No called entries found' });
  }

  db.prepare(`UPDATE queue_entries SET status = 'attended' WHERE id = ?`).run(entry.id);
  db.prepare(`UPDATE queue_entries SET position = position - 1 WHERE shop_id = ? AND position > ? AND status IN ('waiting', 'called')`).run(id, entry.position);
  updateTodayStats(db, id);
  res.json({ id: entry.id, shopId: entry.shop_id, userId: entry.user_id, position: entry.position, status: 'attended' });
});

router.post('/:id/skip', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !['no_show', 'owner_skip'].includes(reason)) {
    return res.status(400).json({ error: 'reason must be "no_show" or "owner_skip"' });
  }

  const entry = db.prepare(`
    SELECT * FROM queue_entries
    WHERE shop_id = ? AND status = 'called'
    ORDER BY position ASC
    LIMIT 1
  `).get(id);

  if (!entry) {
    return res.status(404).json({ error: 'No called entries found' });
  }

  db.prepare(`UPDATE queue_entries SET status = 'skipped', skip_reason = ? WHERE id = ?`).run(reason, entry.id);
  db.prepare(`UPDATE queue_entries SET position = position - 1 WHERE shop_id = ? AND position > ? AND status IN ('waiting', 'called')`).run(id, entry.position);
  updateTodayStats(db, id);
  res.json({ id: entry.id, shopId: entry.shop_id, userId: entry.user_id, position: entry.position, status: 'skipped', skipReason: reason });
});

router.post('/:id/close', (req, res) => {
  const { id } = req.params;

  const shop = db.prepare(`SELECT * FROM shops WHERE id = ?`).get(id);
  if (!shop) {
    return res.status(404).json({ error: 'Shop not found' });
  }

  db.prepare(`UPDATE queue_entries SET status = 'cancelled' WHERE shop_id = ? AND status = 'waiting'`).run(id);
  db.prepare(`UPDATE queue_entries SET status = 'skipped', skip_reason = 'owner_skip' WHERE shop_id = ? AND status = 'called'`).run(id);

  updateTodayStats(db, id);
  db.prepare(`UPDATE queue_stats SET is_finalized = 1 WHERE shop_id = ? AND date = date('now')`).run(id);

  db.prepare(`UPDATE shops SET is_open = 0 WHERE id = ?`).run(id);
  res.json({ success: true });
});

module.exports = router;