import 'dotenv/config';
import pool from './db.js';

const migrations = `
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY,
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
  title TEXT NOT NULL,
  note TEXT,
  priority TEXT DEFAULT 'normal',
  due_date DATE,
  due_time TEXT,
  tags TEXT[] DEFAULT '{}',
  done BOOLEAN DEFAULT false,
  linked_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(archived);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
`;

async function migrate() {
  try {
    await pool.query(migrations);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
