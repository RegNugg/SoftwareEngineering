const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.category, s.location_x AS locationX, s.location_y AS locationY,
           s.lat, s.lng, s.is_open AS isOpen, s.avg_service_time AS avgServiceTime,
           s.owner_id AS ownerId, u.name AS ownerName
    FROM shops s
    LEFT JOIN users u ON s.owner_id = u.id
  `).all();
  res.json(rows);
});

router.get('/search', (req, res) => {
  const { q, category } = req.query;
  let sql = `
    SELECT s.id, s.name, s.category, s.location_x AS locationX, s.location_y AS locationY,
           s.lat, s.lng, s.is_open AS isOpen, s.avg_service_time AS avgServiceTime,
           s.owner_id AS ownerId, u.name AS ownerName
    FROM shops s
    LEFT JOIN users u ON s.owner_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    sql += ` AND s.name LIKE ?`;
    params.push(`%${q}%`);
  }
  if (category && category !== 'All') {
    sql += ` AND s.category = ?`;
    params.push(category);
  }

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare(`
    SELECT s.id, s.name, s.category, s.location_x AS locationX, s.location_y AS locationY,
           s.lat, s.lng, s.is_open AS isOpen, s.avg_service_time AS avgServiceTime,
           s.owner_id AS ownerId, u.name AS ownerName
    FROM shops s
    LEFT JOIN users u ON s.owner_id = u.id
    WHERE s.id = ?
  `).get(id);
  if (!row) {
    return res.status(404).json({ error: 'Shop not found' });
  }
  res.json(row);
});

router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { isOpen } = req.body;

  if (typeof isOpen !== 'boolean' && isOpen !== 0 && isOpen !== 1) {
    return res.status(400).json({ error: 'isOpen boolean is required' });
  }

  const isOpenVal = isOpen ? 1 : 0;

  const result = db.prepare(`UPDATE shops SET is_open = ? WHERE id = ?`).run(isOpenVal, id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Shop not found' });
  }

  const row = db.prepare(`
    SELECT s.id, s.name, s.category, s.location_x AS locationX, s.location_y AS locationY,
           s.lat, s.lng, s.is_open AS isOpen, s.avg_service_time AS avgServiceTime,
           s.owner_id AS ownerId, u.name AS ownerName
    FROM shops s
    LEFT JOIN users u ON s.owner_id = u.id
    WHERE s.id = ?
  `).get(id);

  res.json(row);
});

router.get('/:id/analytics', (req, res) => {
  const { id } = req.params;

  const shop = db.prepare(`SELECT id, name, is_open AS isOpen FROM shops WHERE id = ?`).get(id);
  if (!shop) {
    return res.status(404).json({ error: 'Shop not found' });
  }

  function computeFromStats(rows) {
    if (rows.length === 0) {
      return {
        totalCustomers: 0,
        customersServed: 0,
        noShows: 0,
        skipped: 0,
        cancelled: 0,
        avgWaitSeconds: null,
        peakHour: null,
        serviceRate: 0,
      };
    }

    const totalCustomers = rows.reduce((sum, r) => sum + (r.total_customers || 0), 0);
    const customersServed = rows.reduce((sum, r) => sum + (r.customers_served || 0), 0);
    const noShows = rows.reduce((sum, r) => sum + (r.no_shows || 0), 0);
    const skipped = rows.reduce((sum, r) => sum + (r.skips || 0), 0);
    const cancelled = rows.reduce((sum, r) => sum + (r.cancelled || 0), 0);

    const totalWait = rows.reduce((sum, r) => sum + ((r.avg_wait_seconds || 0) * (r.total_customers || 0)), 0);
    const totalWithWait = rows.reduce((sum, r) => sum + (r.total_customers || 0), 0);
    const avgWaitSeconds = totalWithWait > 0 ? Math.round(totalWait / totalWithWait) : null;

    const hourCounts = {};
    rows.forEach(r => {
      if (r.peak_hour !== null && r.peak_hour !== undefined) {
        hourCounts[r.peak_hour] = (hourCounts[r.peak_hour] || 0) + (r.total_customers || 0);
      }
    });
    let peakHour = null;
    if (Object.keys(hourCounts).length > 0) {
      const sorted = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
      peakHour = parseInt(sorted[0][0]);
    }

    const denominator = customersServed + skipped + cancelled;
    const serviceRate = denominator > 0 ? parseFloat((customersServed / denominator).toFixed(2)) : 0;

    return {
      totalCustomers,
      customersServed,
      noShows,
      skipped,
      cancelled,
      avgWaitSeconds,
      peakHour,
      serviceRate,
    };
  }

  const todayStats = db.prepare(
    `SELECT * FROM queue_stats WHERE shop_id = ? AND date = date('now') AND is_finalized = 1`
  ).all(id);

  const allStats = db.prepare(
    `SELECT * FROM queue_stats WHERE shop_id = ? AND is_finalized = 1`
  ).all(id);

  const todayStatsData = (todayStats.length > 0 && !shop.isOpen) ? computeFromStats(todayStats) : null;
  const allTimeStats = computeFromStats(allStats);

  res.json({
    shopId: id,
    shopName: shop.name,
    today: todayStatsData,
    allTime: allTimeStats,
  });
});

module.exports = router;