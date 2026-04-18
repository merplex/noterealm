import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// ใช้ pool แยกสำหรับ migration — ไม่กระทบ pool หลักของ app
const migratePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

const migrations = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  pinned BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  images TEXT[] DEFAULT '{}',
  ai_blocks JSONB DEFAULT '[]',
  "group" TEXT,
  source TEXT DEFAULT 'manual',
  refs TEXT[] DEFAULT '{}',
  history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  priority TEXT DEFAULT 'normal',
  due_date DATE,
  due_time TEXT,
  tags TEXT[] DEFAULT '{}',
  done BOOLEAN DEFAULT false,
  linked_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  label TEXT,
  webhook_url TEXT,
  api_key TEXT,
  contact_map JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to existing tables if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='user_id') THEN
    ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='user_id') THEN
    ALTER TABLE todos ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='deleted_at') THEN
    ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='deleted_at') THEN
    ALTER TABLE todos ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='updated_at') THEN
    ALTER TABLE todos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='inbox_token') THEN
    ALTER TABLE users ADD COLUMN inbox_token TEXT UNIQUE;
    UPDATE users SET inbox_token = substr(md5(random()::text), 1, 10) WHERE inbox_token IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_filter_spam') THEN
    ALTER TABLE users ADD COLUMN email_filter_spam BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_filter_ads') THEN
    ALTER TABLE users ADD COLUMN email_filter_ads BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_filter_summary') THEN
    ALTER TABLE users ADD COLUMN email_filter_summary BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='settings') THEN
    ALTER TABLE users ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
  -- Tombstone columns สำหรับ permanent delete sync
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='permanently_deleted_at') THEN
    ALTER TABLE notes ADD COLUMN permanently_deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='permanently_deleted_at') THEN
    ALTER TABLE todos ADD COLUMN permanently_deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  -- Repeat todo fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='repeat_enabled') THEN
    ALTER TABLE todos ADD COLUMN repeat_enabled BOOLEAN DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='repeat_every') THEN
    ALTER TABLE todos ADD COLUMN repeat_every INT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='repeat_unit') THEN
    ALTER TABLE todos ADD COLUMN repeat_unit TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='repeat_start_date') THEN
    ALTER TABLE todos ADD COLUMN repeat_start_date TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='repeat_parent_id') THEN
    ALTER TABLE todos ADD COLUMN repeat_parent_id TEXT DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(archived);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
`;

async function migrate() {
  try {
    await migratePool.query(migrations);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await migratePool.end();
  }
}

// สำหรับ auto-migrate ตอน server start (ใช้ pool หลัก)
export async function autoMigrate(pool) {
  try {
    await pool.query(migrations);
    console.log('[DB] Auto-migration completed');
  } catch (err) {
    console.error('[DB] Auto-migration failed:', err.message);
  }
}

// รัน standalone ถ้าเรียกตรง (npm run db:migrate)
migrate();
