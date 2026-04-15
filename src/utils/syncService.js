import { db } from '../db/localDb';

const BASE = import.meta.env.VITE_API_URL ?? '';
const LAST_SYNC_KEY = 'nk_last_sync_at';
const SYNC_DIRECTION_KEY = 'nk_sync_direction'; // 'server' | 'local'
export const SYNC_AUTO_KEY = 'nk_sync_auto';
const USER_ID_KEY = 'nk_user_id';

export function setUserId(id) {
  if (id) localStorage.setItem(USER_ID_KEY, id);
  else localStorage.removeItem(USER_ID_KEY);
}

export function getUserId() {
  return localStorage.getItem(USER_ID_KEY) || null;
}

async function req(path, options = {}) {
  const userId = getUserId();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'X-User-Id': userId } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Emit event เมื่อ sync เสร็จ — Settings ฟังได้
function emitSyncUpdated() {
  window.dispatchEvent(new Event('sync-updated'));
}

export function isAutoSyncEnabled() {
  return localStorage.getItem(SYNC_AUTO_KEY) !== 'false'; // default = true
}

// --- Push ---

async function pushNote(note) {
  const { dirty, syncSource, ...payload } = note;
  try {
    if (syncSource === 'local') {
      await req('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      await req(`/api/notes/${note.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    }
    await db.notes.update(note.id, { dirty: false, syncSource: 'server' });
  } catch (e) {
    console.warn(`[sync] push note ${note.id} failed:`, e.message);
    throw e;
  }
}

async function pushTodo(todo) {
  const { dirty, syncSource, ...payload } = todo;
  try {
    if (syncSource === 'local') {
      await req('/api/todos', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      await req(`/api/todos/${todo.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    }
    await db.todos.update(todo.id, { dirty: false, syncSource: 'server' });
  } catch (e) {
    console.warn(`[sync] push todo ${todo.id} failed:`, e.message);
    throw e;
  }
}

export async function pushDirty() {
  const [dirtyNotes, dirtyTodos] = await Promise.all([
    db.notes.filter(n => !!n.dirty).toArray(),
    db.todos.filter(t => !!t.dirty).toArray(),
  ]);
  await Promise.all([
    ...dirtyNotes.map(pushNote),
    ...dirtyTodos.map(pushTodo),
  ]);
}

// --- Pull & Merge ---

async function mergeNotes(serverNotes) {
  const updates = [];
  for (const sn of serverNotes) {
    const local = await db.notes.get(sn.id);

    // tombstone: ถูก permanent-delete บนเครื่องอื่น → ลบ local ด้วย
    if (sn.permanentlyDeletedAt) {
      if (local) updates.push(db.notes.delete(sn.id));
      continue;
    }

    if (!local) {
      updates.push(db.notes.put({ ...sn, syncSource: 'server', dirty: false }));
    } else if (local.syncSource === 'server') {
      if (new Date(sn.updatedAt) > new Date(local.updatedAt)) {
        updates.push(db.notes.put({ ...sn, syncSource: 'server', dirty: false }));
      }
    }
  }
  await Promise.all(updates);
}

// fields ที่เก็บแค่ local — server อาจไม่รู้จัก → preserve จาก local ถ้า server ไม่ส่งมา
const LOCAL_ONLY_FIELDS = [
  'repeatEnabled', 'repeatEvery', 'repeatUnit',
  'repeatStartDate', 'repeatParentId',
];

/** normalize date fields จาก server (PostgreSQL ส่ง ISO full string) → YYYY-MM-DD */
function normalizeTodoFromServer(st) {
  const out = { ...st };
  if (out.dueDate && out.dueDate.includes('T')) out.dueDate = out.dueDate.split('T')[0];
  return out;
}

async function mergeTodos(serverTodos) {
  const updates = [];
  for (const raw of serverTodos) {
    const st = normalizeTodoFromServer(raw);
    const local = await db.todos.get(st.id);

    // tombstone: ถูก permanent-delete บนเครื่องอื่น → ลบ local ด้วย
    if (st.permanentlyDeletedAt) {
      if (local) updates.push(db.todos.delete(st.id));
      continue;
    }

    if (!local) {
      updates.push(db.todos.put({ ...st, syncSource: 'server', dirty: false }));
    } else if (local.syncSource === 'server') {
      if (new Date(st.updatedAt) > new Date(local.updatedAt)) {
        // เก็บ field ที่ server ไม่รู้จักไว้จาก local
        const preserved = {};
        for (const key of LOCAL_ONLY_FIELDS) {
          if (local[key] !== undefined && st[key] === undefined) {
            preserved[key] = local[key];
          }
        }
        updates.push(db.todos.put({ ...st, ...preserved, syncSource: 'server', dirty: false }));
      }
    }
  }
  await Promise.all(updates);
}

export async function pull() {
  const since = localStorage.getItem(LAST_SYNC_KEY) || '';
  const sinceParam = since ? `?since=${encodeURIComponent(since)}` : '';
  const [serverNotes, serverTodos] = await Promise.all([
    req(`/api/notes${sinceParam}`),
    req(`/api/todos${sinceParam}`),
  ]);
  await Promise.all([mergeNotes(serverNotes), mergeTodos(serverTodos)]);
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

// Full sync: push dirty → pull → emit event
export async function sync(direction = 'server') {
  await pushDirty();
  await pull();
  localStorage.setItem(SYNC_DIRECTION_KEY, direction);
  emitSyncUpdated();
}

export function getSyncInfo() {
  return {
    lastSyncAt: localStorage.getItem(LAST_SYNC_KEY),
    direction: localStorage.getItem(SYNC_DIRECTION_KEY) || 'server',
  };
}

// Auto sync — เรียกจาก AppContext (ตรวจ toggle + user ก่อน)
export async function autoSync() {
  if (!isAutoSyncEnabled()) return;
  if (!getUserId()) return; // ไม่ sync ถ้าไม่ได้ login
  await sync();
}
