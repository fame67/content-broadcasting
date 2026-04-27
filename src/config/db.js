const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // ── Connection pool settings ──────────────────────────
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,

  // ── Keep connections alive (fixes ECONNRESET) ─────────
  enableKeepAlive:        true,
  keepAliveInitialDelay:  0,

  // ── Timeouts ──────────────────────────────────────────
  connectTimeout:         10000,   // 10s to establish connection
  
  // ── Reconnect on lost connection ──────────────────────
  // mysql2 pools auto-reconnect, but these help with stale connections:
  idleTimeout:            60000,   // Remove idle connections after 60s
  maxIdle:                10,
});

// ── Test connection on startup ─────────────────────────────────
pool.getConnection()
  .then(conn => {
    console.log('✅ Database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1); // Crash early if DB is unreachable
  });

module.exports = pool;