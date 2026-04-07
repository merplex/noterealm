import pg from 'pg';
const { Pool } = pg;

// Parse DATABASE_URL manually to handle special characters in password
function buildPoolConfig() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[DB] DATABASE_URL is not set!');
    return {};
  }

  // Use individual PG* env vars if available (Railway provides these)
  if (process.env.PGHOST) {
    console.log('[DB] Using individual PG* env vars (PGHOST, etc.)');
    return {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'railway',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  // Parse URL manually to avoid issues with special chars in password
  try {
    const url = new URL(dbUrl);
    const config = {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1), // remove leading /
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
    // Log connection target (without password) for debugging
    console.log(`[DB] Connecting to ${config.host}:${config.port}/${config.database} as ${config.user}`);
    return config;
  } catch (e) {
    console.error('[DB] Failed to parse DATABASE_URL, using as-is:', e.message);
    return {
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }
}

const pool = new Pool({
  ...buildPoolConfig(),
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
