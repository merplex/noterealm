import { createContext, useContext, useReducer, useEffect, useMemo, useRef } from 'react';
import { storage } from '../constants/storage';
import { STORAGE_KEYS } from '../constants/providers';
import { notesApi, todosApi } from '../utils/api';

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
  stateRef.current = state; // อัปเดต ref ทุก render เพื่อกัน stale closure ใน actions

  // Load non-API state from local storage + fetch notes/todos from API
  useEffect(() => {
    (async () => {
      // Load local-only settings
      const localKeys = ['aiSettings', 'connections', 'user', 'groups', 'tags', 'activeTab', 'noteViewMode', 'todoViewMode', 'sortBy', 'sortDir', 'defaultTab', 'lineTrim'];
      const loaded = {};
      for (const key of localKeys) {
        const val = await storage.get(STORAGE_KEYS[key]);
        if (val !== null) loaded[key] = val;
      }
      dispatch({ type: 'LOAD_STATE', payload: loaded });

      // Fetch notes & todos from backend
      try {
        const [notes, todos] = await Promise.all([notesApi.list(), todosApi.list()]);
        dispatch({ type: 'SET_NOTES', payload: notes });
        dispatch({ type: 'SET_TODOS', payload: todos });
      } catch (err) {
        console.error('Failed to load from API:', err);
      }
    })();
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

  // Async actions that call API then update local state
  const actions = useMemo(() => ({
    addNote: async (noteData) => {
      const saved = await notesApi.create(noteData);
      dispatch({ type: 'ADD_NOTE', payload: saved });
      return saved;
    },
    updateNote: async (noteData) => {
      const saved = await notesApi.update(noteData.id, noteData);
      dispatch({ type: 'UPDATE_NOTE', payload: saved });
      return saved;
    },
    deleteNote: async (id) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      if (note) {
        const deletedAt = new Date().toISOString();
        dispatch({ type: 'UPDATE_NOTE', payload: { ...note, deletedAt } });
        await notesApi.softDelete(id, deletedAt);
      }
    },
    restoreNote: async (id) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      if (note) {
        dispatch({ type: 'UPDATE_NOTE', payload: { ...note, deletedAt: null } });
        await notesApi.softDelete(id, null);
      }
    },
    permanentDeleteNote: async (id) => {
      await notesApi.delete(id);
      dispatch({ type: 'DELETE_NOTE', payload: id });
    },
    archiveNote: async (id) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      if (!note) return;
      const saved = await notesApi.update(id, { ...note, archived: true });
      dispatch({ type: 'UPDATE_NOTE', payload: saved });
    },
    unarchiveNote: async (id) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      if (!note) return;
      const saved = await notesApi.update(id, { ...note, archived: false });
      dispatch({ type: 'UPDATE_NOTE', payload: saved });
    },
    addTodo: async (todoData) => {
      const saved = await todosApi.create(todoData);
      dispatch({ type: 'ADD_TODO', payload: saved });
      return saved;
    },
    updateTodo: async (todoData) => {
      const saved = await todosApi.update(todoData.id, todoData);
      dispatch({ type: 'UPDATE_TODO', payload: saved });
      return saved;
    },
    deleteTodo: async (id) => {
      await todosApi.delete(id);
      dispatch({ type: 'DELETE_TODO', payload: id });
    },
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
