function updateTodayStats(db, shopId) {
  const entries = db.prepare(
    `SELECT * FROM queue_entries WHERE shop_id = ? AND date(joined_at) = date('now')`
  ).all(shopId);

  const customersServed = entries.filter(e => e.status === 'attended').length;
  const customersSkipped = entries.filter(e => e.status === 'skipped').length;
  const noShows = entries.filter(e => e.skip_reason === 'no_show').length;
  const ownerSkips = entries.filter(e => e.skip_reason === 'owner_skip').length;
  const cancelled = entries.filter(e => e.status === 'cancelled').length;
  const totalCustomers = customersServed + customersSkipped + cancelled;

  const calledEntries = entries.filter(e => e.called_at && e.joined_at);
  let avgWaitSeconds = null;
  if (calledEntries.length > 0) {
    const totalWait = calledEntries.reduce((sum, e) => {
      const joined = new Date(e.joined_at).getTime();
      const called = new Date(e.called_at).getTime();
      return sum + Math.max(0, (called - joined) / 1000);
    }, 0);
    avgWaitSeconds = Math.round(totalWait / calledEntries.length);
  }

  let peakHour = null;
  if (entries.length > 0) {
    const hourCounts = {};
    entries.forEach(e => {
      if (e.joined_at) {
        const h = new Date(e.joined_at).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    });
    const sorted = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      peakHour = parseInt(sorted[0][0]);
    }
  }

  const denominator = customersServed + ownerSkips + cancelled;
  const serviceRate = denominator > 0 ? parseFloat((customersServed / denominator).toFixed(2)) : 0;

  const statsId = `stats-${shopId}-${new Date().toISOString().split('T')[0]}`;
  db.prepare(
    `INSERT OR REPLACE INTO queue_stats (id, shop_id, date, customers_served, customers_skipped, no_shows, skips, cancelled, avg_wait_seconds, peak_hour, total_customers, service_rate, is_finalized)
     VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(statsId, shopId, customersServed, customersSkipped, noShows, ownerSkips, cancelled, avgWaitSeconds, peakHour, totalCustomers, serviceRate);
}

module.exports = { updateTodayStats };
