import { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import { storage } from '../constants/storage';
import { STORAGE_KEYS } from '../constants/providers';
import { notesApi, todosApi } from '../utils/api';
import { db } from '../db/localDb';
import { sync, autoSync, pushDirty, pull } from '../utils/syncService';

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
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, showSplash: true };
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
      const localKeys = ['aiSettings', 'connections', 'user', 'groups', 'tags', 'activeTab', 'noteViewMode', 'todoViewMode', 'sortBy', 'sortDir', 'defaultTab', 'lineTrim'];
      const loaded = {};
      for (const key of localKeys) {
        const val = await storage.get(STORAGE_KEYS[key]);
        if (val !== null) loaded[key] = val;
      }
      dispatch({ type: 'LOAD_STATE', payload: loaded });

      // 2. Load from IndexedDB immediately (instant, offline-first)
      const [localNotes, localTodos] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().toArray(),
        db.todos.orderBy('updatedAt').reverse().toArray(),
      ]);
      dispatch({ type: 'SET_NOTES', payload: localNotes });
      dispatch({ type: 'SET_TODOS', payload: localTodos });

      // 3. Auto sync in background (ถ้า toggle เปิดอยู่)
      autoSync().then(async () => {
        const [notes, todos] = await Promise.all([
          db.notes.orderBy('updatedAt').reverse().toArray(),
          db.todos.orderBy('updatedAt').reverse().toArray(),
        ]);
        dispatch({ type: 'SET_NOTES', payload: notes });
        dispatch({ type: 'SET_TODOS', payload: todos });
      }).catch(console.warn);
    })();
  }, []);

  // Sync when app comes back to foreground
  useEffect(() => {
    const handleFocus = () => {
      autoSync().then(async () => {
        const [notes, todos] = await Promise.all([
          db.notes.orderBy('updatedAt').reverse().toArray(),
          db.todos.orderBy('updatedAt').reverse().toArray(),
        ]);
        dispatch({ type: 'SET_NOTES', payload: notes });
        dispatch({ type: 'SET_TODOS', payload: todos });
      }).catch(console.warn);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
  }, [state.aiSettings, state.connections, state.user, state.groups, state.tags, state.activeTab, state.noteViewMode, state.todoViewMode, state.sortBy, state.sortDir, state.defaultTab, state.lineTrim]);

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
      const todo = { ...todoData, syncSource: 'local', dirty: true };
      await db.todos.put(todo);
      dispatch({ type: 'ADD_TODO', payload: todo });
      pushDirty().catch(console.warn);
      return todo;
    },
    updateTodo: async (todoData) => {
      const existing = await db.todos.get(todoData.id);
      const todo = {
        ...todoData,
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
