import { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import { storage } from '../constants/storage';
import { STORAGE_KEYS } from '../constants/providers';
import { notesApi, todosApi } from '../utils/api';
import { db } from '../db/localDb';
import { sync, autoSync, pushDirty, pull, setUserId } from '../utils/syncService';

const AppContext = createContext(null);

const initialState = {
  notes: [],
  groups: [],
  tags: [],
  todos: [],
  aiSettings: {},
  connections: [],
  user: null,
  activeTab: 'note',
  noteViewMode: 'grid',
  todoViewMode: 'list',
  sortBy: 'updated',
  sortDir: 'desc',
  defaultTab: 'note',
  lineTrim: 'month',
  profileImage: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE': {
      const loaded = { ...state, ...action.payload, showSplash: true };
      // ใช้ defaultTab เป็น activeTab ตอน startup
      if (action.payload.defaultTab) loaded.activeTab = action.payload.defaultTab;
      return loaded;
    }
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_NOTE_VIEW_MODE':
      return { ...state, noteViewMode: action.payload };
    case 'SET_TODO_VIEW_MODE':
      return { ...state, todoViewMode: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload.sortBy ?? state.sortBy, sortDir: action.payload.sortDir ?? state.sortDir };
    case 'SET_DEFAULT_TAB':
      return { ...state, defaultTab: action.payload };
    case 'SET_PROFILE_IMAGE':
      return { ...state, profileImage: action.payload };
    case 'SET_LINE_TRIM':
      return { ...state, lineTrim: action.payload };

    // Notes
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'ADD_NOTE':
      return { ...state, notes: [action.payload, ...state.notes] };
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.payload.id ? { ...n, ...action.payload } : n
        ),
      };
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.payload) };

    // Todos
    case 'SET_TODOS':
      return { ...state, todos: action.payload };
    case 'ADD_TODO':
      return { ...state, todos: [action.payload, ...state.todos] };
    case 'UPDATE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
      };
    case 'DELETE_TODO':
      return { ...state, todos: state.todos.filter((t) => t.id !== action.payload) };

    // Tags & Groups
    case 'SET_TAGS':
      return { ...state, tags: action.payload };
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };

    // Connections
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.payload };

    // User
    case 'SET_USER':
      return { ...state, user: action.payload };

    // AI Settings
    case 'SET_AI_SETTINGS':
      return { ...state, aiSettings: action.payload };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load on startup: IndexedDB first (instant) → sync with server (background)
  useEffect(() => {
    (async () => {
      // 1. Load local settings
      const localKeys = ['aiSettings', 'connections', 'user', 'groups', 'tags', 'activeTab', 'noteViewMode', 'todoViewMode', 'sortBy', 'sortDir', 'defaultTab', 'lineTrim', 'profileImage'];
      const loaded = {};
      for (const key of localKeys) {
        const val = await storage.get(STORAGE_KEYS[key]);
        if (val !== null) loaded[key] = val;
      }
      dispatch({ type: 'LOAD_STATE', payload: loaded });
      // Restore userId for sync (sync ใช้ localStorage key แยก)
      if (loaded.user?.id) setUserId(loaded.user.id);

      // 2. Load from IndexedDB immediately (instant, offline-first)
      const [localNotes, localTodos] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().toArray(),
        db.todos.orderBy('updatedAt').reverse().toArray(),
      ]);
      dispatch({ type: 'SET_NOTES', payload: localNotes });
      dispatch({ type: 'SET_TODOS', payload: localTodos });

      // 3. Auto sync in background (ถ้า toggle เปิดอยู่) แล้ว re-read IndexedDB
      const reloadLocal = async () => {
        const [n, t] = await Promise.all([
          db.notes.orderBy('updatedAt').reverse().toArray(),
          db.todos.orderBy('updatedAt').reverse().toArray(),
        ]);
        dispatch({ type: 'SET_NOTES', payload: n });
        dispatch({ type: 'SET_TODOS', payload: t });
      };
      autoSync().then(() => reloadLocal()).catch(console.warn);
    })();
  }, []);

  // Sync when app comes back to foreground
  // อ่าน IndexedDB ก่อนเสมอ (ไม่ผูกกับ sync) เพื่อป้องกันหน้าจอค้างเป็น empty
  useEffect(() => {
    const readLocal = async () => {
      const [notes, todos] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().toArray(),
        db.todos.orderBy('updatedAt').reverse().toArray(),
      ]);
      dispatch({ type: 'SET_NOTES', payload: notes });
      dispatch({ type: 'SET_TODOS', payload: todos });
    };

    const refreshFromDb = async () => {
      // 1. อ่าน local ก่อนเสมอ — ไม่ว่า network จะพร้อมหรือไม่
      await readLocal().catch(console.warn);
      // 2. แล้วค่อย sync กับ server (ถ้าได้)
      autoSync().then(() => readLocal()).catch(console.warn);
    };

    const handleVisibility = () => {
      if (!document.hidden) refreshFromDb();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    // Capacitor fires 'resume' on document เมื่อแอปกลับจาก background — reliable กว่า visibilitychange บน Android
    document.addEventListener('resume', refreshFromDb);

    // Periodic auto sync ทุก 5 นาที (ป้องกันค้างถ้า visibility event ไม่ fire)
    const interval = setInterval(refreshFromDb, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('resume', refreshFromDb);
      clearInterval(interval);
    };
  }, []);

  // Save local-only state to storage
  useEffect(() => {
    if (state === initialState) return;
    storage.set(STORAGE_KEYS.aiSettings, state.aiSettings);
    storage.set(STORAGE_KEYS.connections, state.connections);
    storage.set(STORAGE_KEYS.user, state.user);
    storage.set(STORAGE_KEYS.groups, state.groups);
    storage.set(STORAGE_KEYS.tags, state.tags);
    storage.set(STORAGE_KEYS.activeTab, state.activeTab);
    storage.set(STORAGE_KEYS.noteViewMode, state.noteViewMode);
    storage.set(STORAGE_KEYS.todoViewMode, state.todoViewMode);
    storage.set(STORAGE_KEYS.sortBy, state.sortBy);
    storage.set(STORAGE_KEYS.sortDir, state.sortDir);
    storage.set(STORAGE_KEYS.defaultTab, state.defaultTab);
    storage.set(STORAGE_KEYS.lineTrim, state.lineTrim);
    storage.set(STORAGE_KEYS.profileImage, state.profileImage);
  }, [state.aiSettings, state.connections, state.user, state.groups, state.tags, state.activeTab, state.noteViewMode, state.todoViewMode, state.sortBy, state.sortDir, state.defaultTab, state.lineTrim, state.profileImage]);

  const actions = useMemo(() => ({
    addNote: async (noteData) => {
      const userId = stateRef.current.user?.id || null;
      const note = { ...noteData, userId, syncSource: 'local', dirty: true };
      await db.notes.put(note);
      dispatch({ type: 'ADD_NOTE', payload: note });
      pushDirty().catch(console.warn);
      return note;
    },
    updateNote: async (noteData) => {
      const existing = await db.notes.get(noteData.id);
      const userId = existing?.userId || stateRef.current.user?.id || null;
      const note = {
        ...noteData,
        userId,
        syncSource: existing?.syncSource || 'local',
        dirty: true,
      };
      await db.notes.put(note);
      dispatch({ type: 'UPDATE_NOTE', payload: note });
      pushDirty().catch(console.warn);
      return note;
    },
    deleteNote: async (id) => {
      const note = await db.notes.get(id);
      if (note) {
        const deletedAt = new Date().toISOString();
        const updated = { ...note, deletedAt, dirty: true };
        await db.notes.put(updated);
        dispatch({ type: 'UPDATE_NOTE', payload: updated });
        if (note.syncSource === 'server') {
          notesApi.softDelete(id, deletedAt).catch(console.warn);
        }
      }
    },
    restoreNote: async (id) => {
      const note = await db.notes.get(id);
      if (note) {
        const updated = { ...note, deletedAt: null, dirty: true };
        await db.notes.put(updated);
        dispatch({ type: 'UPDATE_NOTE', payload: updated });
        if (note.syncSource === 'server') {
          notesApi.softDelete(id, null).catch(console.warn);
        }
      }
    },
    permanentDeleteNote: async (id) => {
      const note = await db.notes.get(id);
      await db.notes.delete(id);
      dispatch({ type: 'DELETE_NOTE', payload: id });
      if (note?.syncSource === 'server') {
        notesApi.delete(id).catch(console.warn);
      }
    },
    archiveNote: async (id) => {
      const note = await db.notes.get(id);
      if (!note) return;
      const updated = { ...note, archived: true, dirty: true };
      await db.notes.put(updated);
      dispatch({ type: 'UPDATE_NOTE', payload: updated });
      if (note.syncSource === 'server') {
        notesApi.update(id, { ...note, archived: true }).catch(console.warn);
      }
    },
    unarchiveNote: async (id) => {
      const note = await db.notes.get(id);
      if (!note) return;
      const updated = { ...note, archived: false, dirty: true };
      await db.notes.put(updated);
      dispatch({ type: 'UPDATE_NOTE', payload: updated });
      if (note.syncSource === 'server') {
        notesApi.update(id, { ...note, archived: false }).catch(console.warn);
      }
    },
    addTodo: async (todoData) => {
      const userId = stateRef.current.user?.id || null;
      const now = new Date().toISOString();
      const todo = { ...todoData, userId, updatedAt: todoData.updatedAt || now, createdAt: todoData.createdAt || now, syncSource: 'local', dirty: true };
      await db.todos.put(todo);
      dispatch({ type: 'ADD_TODO', payload: todo });
      pushDirty().catch(console.warn);
      return todo;
    },
    updateTodo: async (todoData) => {
      const existing = await db.todos.get(todoData.id);
      const userId = existing?.userId || stateRef.current.user?.id || null;
      const now = new Date().toISOString();
      const todo = {
        ...todoData,
        userId,
        updatedAt: now,
        syncSource: existing?.syncSource || 'local',
        dirty: true,
      };
      await db.todos.put(todo);
      dispatch({ type: 'UPDATE_TODO', payload: todo });
      pushDirty().catch(console.warn);
      return todo;
    },
    deleteTodo: async (id) => {
      const todo = await db.todos.get(id);
      if (todo) {
        const deletedAt = new Date().toISOString();
        const updated = { ...todo, deletedAt, dirty: true };
        await db.todos.put(updated);
        dispatch({ type: 'UPDATE_TODO', payload: updated });
        if (todo.syncSource === 'server') {
          todosApi.softDelete(id, deletedAt).catch(console.warn);
        }
      }
    },
    restoreTodo: async (id) => {
      const todo = await db.todos.get(id);
      if (todo) {
        const updated = { ...todo, deletedAt: null, dirty: true };
        await db.todos.put(updated);
        dispatch({ type: 'UPDATE_TODO', payload: updated });
        if (todo.syncSource === 'server') {
          todosApi.softDelete(id, null).catch(console.warn);
        }
      }
    },
    permanentDeleteTodo: async (id) => {
      const todo = await db.todos.get(id);
      await db.todos.delete(id);
      dispatch({ type: 'DELETE_TODO', payload: id });
      if (todo?.syncSource === 'server') {
        todosApi.delete(id).catch(console.warn);
      }
    },
    // Tag management — rename/delete across all notes & todos
    renameTag: async (oldTag, newTag) => {
      const trimmed = newTag.trim();
      if (!trimmed || trimmed === oldTag) return;
      const [notes, todos] = await Promise.all([
        db.notes.filter(n => (n.tags || []).includes(oldTag)).toArray(),
        db.todos.filter(t => (t.tags || []).includes(oldTag)).toArray(),
      ]);
      await Promise.all([
        ...notes.map(n => {
          const updated = { ...n, tags: n.tags.map(t => t === oldTag ? trimmed : t), dirty: true };
          dispatch({ type: 'UPDATE_NOTE', payload: updated });
          return db.notes.put(updated);
        }),
        ...todos.map(t => {
          const updated = { ...t, tags: t.tags.map(tg => tg === oldTag ? trimmed : tg), dirty: true };
          dispatch({ type: 'UPDATE_TODO', payload: updated });
          return db.todos.put(updated);
        }),
      ]);
    },
    deleteTag: async (tag) => {
      const [notes, todos] = await Promise.all([
        db.notes.filter(n => (n.tags || []).includes(tag)).toArray(),
        db.todos.filter(t => (t.tags || []).includes(tag)).toArray(),
      ]);
      await Promise.all([
        ...notes.map(n => {
          const updated = { ...n, tags: n.tags.filter(t => t !== tag), dirty: true };
          dispatch({ type: 'UPDATE_NOTE', payload: updated });
          return db.notes.put(updated);
        }),
        ...todos.map(t => {
          const updated = { ...t, tags: t.tags.filter(tg => tg !== tag), dirty: true };
          dispatch({ type: 'UPDATE_TODO', payload: updated });
          return db.todos.put(updated);
        }),
      ]);
    },
    // Force full sync (เรียกได้จาก UI)
    syncNow: () => sync().then(async () => {
      const [notes, todos] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().toArray(),
        db.todos.orderBy('updatedAt').reverse().toArray(),
      ]);
      dispatch({ type: 'SET_NOTES', payload: notes });
      dispatch({ type: 'SET_TODOS', payload: todos });
    }),
  }), []);

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
