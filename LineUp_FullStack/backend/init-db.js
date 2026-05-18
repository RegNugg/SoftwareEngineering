const db = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('customer', 'owner', 'anon')) NOT NULL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    location_x REAL,
    location_y REAL,
    lat REAL,
    lng REAL,
    is_open BOOLEAN DEFAULT 0,
    avg_service_time INTEGER DEFAULT 300,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS queue_entries (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    status TEXT CHECK(status IN ('waiting', 'called', 'attended', 'skipped', 'cancelled')) DEFAULT 'waiting',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    skip_reason TEXT CHECK(skip_reason IN ('no_show', 'owner_skip', NULL)),
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS queue_stats (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    date DATE,
    customers_served INTEGER DEFAULT 0,
    customers_skipped INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    skips INTEGER DEFAULT 0,
    cancelled INTEGER DEFAULT 0,
    avg_wait_seconds INTEGER,
    peak_hour INTEGER,
    total_customers INTEGER DEFAULT 0,
    service_rate REAL,
    is_finalized BOOLEAN DEFAULT 0,
    FOREIGN KEY (shop_id) REFERENCES shops(id)
  );
`);

const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)');
const insertManyUsers = db.transaction((rows) => { for (const row of rows) insertUser.run(...row); });

insertManyUsers([
  ['owner1', 'Joan Martí', 'joan@martifruits.com', 'owner'],
  ['owner2', 'Josep Vila', 'josep@pepsbakery.com', 'owner'],
  ['owner3', 'Rosa Puig', 'rosa@lapeixateria.com', 'owner'],
  ['owner4', 'Montse Soler', 'montse@carnissera.com', 'owner'],
  ['owner5', 'Ahmed Bensali', 'ahmed@especies.com', 'owner'],
  ['owner6', 'Núria Costa', 'nuria@florsiplantes.com', 'owner'],
]);

const insertShop = db.prepare('INSERT OR IGNORE INTO shops (id, owner_id, name, category, location_x, location_y, lat, lng, is_open, avg_service_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertManyShops = db.transaction((rows) => { for (const row of rows) insertShop.run(...row); });

insertManyShops([
  ['shop1', 'owner1', "Martí's Fruits", 'Fruits & Veg', 28, 22, 41.382, 2.177, 1, 240],
  ['shop2', 'owner2', "Pep's Bakery", 'Bakery', 55, 38, 41.383, 2.179, 1, 180],
  ['shop3', 'owner3', 'La Peixateria', 'Fish', 70, 62, 41.381, 2.180, 1, 360],
  ['shop4', 'owner4', 'Ca la Carnissera', 'Meat', 40, 65, 41.380, 2.178, 0, 300],
  ['shop5', 'owner5', "Espècies del Món", 'Spices', 18, 58, 41.382, 2.175, 1, 120],
  ['shop6', 'owner6', 'Flors i Plantes', 'Flowers', 78, 28, 41.384, 2.181, 1, 180],
]);

insertManyUsers([
  ['cust1', 'Anna García', 'anna@email.com', 'customer'],
  ['cust2', 'Pere Martínez', 'pere@email.com', 'customer'],
  ['cust3', 'Laia Fernández', 'laia@email.com', 'customer'],
  ['cust4', 'Maria Torres', 'maria@email.com', 'customer'],
  ['cust5', 'Joan López', 'joan@email.com', 'customer'],
  ['cust6', 'Clara Ruiz', 'clara@email.com', 'customer'],
  ['cust7', 'Marc Vidal', 'marc@email.com', 'customer'],
  ['cust8', 'Elena Navarro', 'elena@email.com', 'customer'],
  ['cust9', 'David Serra', 'david@email.com', 'customer'],
  ['cust10', 'Sara Domínguez', 'sara@email.com', 'customer'],
]);

db.exec(`
  INSERT OR IGNORE INTO queue_entries (id, shop_id, user_id, position, status, joined_at, called_at, skip_reason)
  VALUES
    ('qe1', 'shop1', 'cust1', 1, 'waiting', datetime('now', '-20 minutes'), NULL, NULL),
    ('qe2', 'shop1', 'cust2', 2, 'waiting', datetime('now', '-15 minutes'), NULL, NULL),
    ('qe3', 'shop2', 'cust3', 1, 'waiting', datetime('now', '-10 minutes'), NULL, NULL),
    ('qe4', 'shop3', 'cust4', 1, 'called', datetime('now', '-25 minutes'), datetime('now', '-18 minutes'), NULL)
`);

const insertStats = db.prepare('INSERT OR IGNORE INTO queue_stats (id, shop_id, date, customers_served, customers_skipped, no_shows, skips, cancelled, avg_wait_seconds, peak_hour, total_customers, service_rate, is_finalized) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertManyStats = db.transaction((rows) => { for (const row of rows) insertStats.run(...row); });

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

insertManyStats([
  ['stats-s1-d1', 'shop1', daysAgo(1), 18, 3, 2, 1, 4, 420, 10, 25, 0.72, 1],
  ['stats-s1-d2', 'shop1', daysAgo(2), 20, 2, 1, 1, 3, 380, 11, 25, 0.80, 1],
  ['stats-s1-d3', 'shop1', daysAgo(3), 15, 4, 3, 1, 2, 450, 10, 21, 0.71, 1],
  ['stats-s1-d4', 'shop1', daysAgo(4), 22, 3, 1, 2, 5, 360, 9, 30, 0.73, 1],
  ['stats-s1-d5', 'shop1', daysAgo(5), 19, 2, 1, 1, 3, 400, 11, 24, 0.79, 1],
  ['stats-s1-d6', 'shop1', daysAgo(6), 16, 3, 2, 1, 2, 480, 10, 21, 0.76, 1],
  ['stats-s1-d7', 'shop1', daysAgo(7), 21, 2, 0, 2, 4, 350, 9, 27, 0.78, 1],

  ['stats-s2-d1', 'shop2', daysAgo(1), 25, 2, 1, 1, 3, 240, 8, 30, 0.83, 1],
  ['stats-s2-d2', 'shop2', daysAgo(2), 28, 3, 2, 1, 2, 260, 9, 33, 0.85, 1],
  ['stats-s2-d3', 'shop2', daysAgo(3), 22, 4, 2, 2, 4, 300, 8, 30, 0.73, 1],
  ['stats-s2-d4', 'shop2', daysAgo(4), 30, 2, 1, 1, 3, 220, 9, 35, 0.86, 1],
  ['stats-s2-d5', 'shop2', daysAgo(5), 26, 3, 2, 1, 2, 280, 8, 31, 0.84, 1],
  ['stats-s2-d6', 'shop2', daysAgo(6), 24, 2, 1, 1, 4, 250, 9, 30, 0.80, 1],
  ['stats-s2-d7', 'shop2', daysAgo(7), 27, 3, 1, 2, 2, 270, 8, 32, 0.84, 1],

  ['stats-s3-d1', 'shop3', daysAgo(1), 12, 3, 2, 1, 3, 600, 12, 18, 0.67, 1],
  ['stats-s3-d2', 'shop3', daysAgo(2), 14, 2, 1, 1, 2, 540, 11, 18, 0.78, 1],
  ['stats-s3-d3', 'shop3', daysAgo(3), 10, 4, 3, 1, 3, 660, 12, 17, 0.59, 1],
  ['stats-s3-d4', 'shop3', daysAgo(4), 15, 2, 1, 1, 2, 520, 11, 19, 0.79, 1],
  ['stats-s3-d5', 'shop3', daysAgo(5), 13, 3, 2, 1, 3, 580, 12, 19, 0.68, 1],
  ['stats-s3-d6', 'shop3', daysAgo(6), 11, 2, 1, 1, 2, 620, 11, 15, 0.73, 1],
  ['stats-s3-d7', 'shop3', daysAgo(7), 14, 3, 2, 1, 3, 560, 12, 20, 0.70, 1],

  ['stats-s4-d1', 'shop4', daysAgo(1), 8, 2, 1, 1, 2, 720, 13, 12, 0.67, 1],
  ['stats-s4-d2', 'shop4', daysAgo(2), 10, 1, 0, 1, 1, 680, 12, 12, 0.83, 1],
  ['stats-s4-d3', 'shop4', daysAgo(3), 7, 3, 2, 1, 2, 750, 13, 12, 0.58, 1],
  ['stats-s4-d4', 'shop4', daysAgo(4), 9, 2, 1, 1, 1, 700, 12, 12, 0.75, 1],
  ['stats-s4-d5', 'shop4', daysAgo(5), 11, 1, 0, 1, 2, 650, 13, 14, 0.79, 1],
  ['stats-s4-d6', 'shop4', daysAgo(6), 8, 2, 1, 1, 1, 730, 12, 11, 0.73, 1],
  ['stats-s4-d7', 'shop4', daysAgo(7), 10, 1, 1, 0, 2, 690, 13, 13, 0.77, 1],

  ['stats-s5-d1', 'shop5', daysAgo(1), 30, 2, 1, 1, 3, 180, 12, 35, 0.86, 1],
  ['stats-s5-d2', 'shop5', daysAgo(2), 35, 3, 2, 1, 4, 160, 11, 42, 0.83, 1],
  ['stats-s5-d3', 'shop5', daysAgo(3), 28, 2, 1, 1, 2, 200, 12, 32, 0.88, 1],
  ['stats-s5-d4', 'shop5', daysAgo(4), 32, 3, 1, 2, 5, 170, 11, 40, 0.80, 1],
  ['stats-s5-d5', 'shop5', daysAgo(5), 33, 2, 1, 1, 3, 190, 12, 38, 0.87, 1],
  ['stats-s5-d6', 'shop5', daysAgo(6), 29, 3, 2, 1, 4, 175, 11, 36, 0.81, 1],
  ['stats-s5-d7', 'shop5', daysAgo(7), 31, 2, 1, 1, 3, 185, 12, 36, 0.86, 1],

  ['stats-s6-d1', 'shop6', daysAgo(1), 15, 2, 1, 1, 2, 300, 10, 19, 0.79, 1],
  ['stats-s6-d2', 'shop6', daysAgo(2), 18, 1, 0, 1, 3, 280, 11, 22, 0.82, 1],
  ['stats-s6-d3', 'shop6', daysAgo(3), 12, 3, 2, 1, 2, 320, 10, 17, 0.71, 1],
  ['stats-s6-d4', 'shop6', daysAgo(4), 20, 2, 1, 1, 3, 260, 11, 25, 0.80, 1],
  ['stats-s6-d5', 'shop6', daysAgo(5), 16, 2, 1, 1, 2, 290, 10, 20, 0.80, 1],
  ['stats-s6-d6', 'shop6', daysAgo(6), 14, 3, 2, 1, 1, 310, 11, 18, 0.78, 1],
  ['stats-s6-d7', 'shop6', daysAgo(7), 17, 2, 1, 1, 2, 270, 10, 21, 0.81, 1],
]);

db.close();
console.log('Database initialized successfully');