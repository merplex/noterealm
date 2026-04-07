import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  max: 10,
});

// Log connection errors so they don't get swallowed silently
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Test connection on startup and log clear status
export async function checkDbConnection() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('[DB] Connected successfully at', res.rows[0].now);
      return true;
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt}/3 failed:`, err.message);
      if (attempt < 3) {
        const delay = attempt * 2000;
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error('[DB] All connection attempts failed. Check DATABASE_URL credentials.');
  return false;
}

export default pool;
