import { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
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
  activeTab: 'note',
  showSplash: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, showSplash: true };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload, showSplash: false };
    case 'HIDE_SPLASH':
      return { ...state, showSplash: false };

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

    // AI Settings
    case 'SET_AI_SETTINGS':
      return { ...state, aiSettings: action.payload };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load non-API state from local storage + fetch notes/todos from API
  useEffect(() => {
    (async () => {
      // Load local-only settings
      const localKeys = ['aiSettings', 'connections', 'groups', 'tags', 'activeTab'];
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
    storage.set(STORAGE_KEYS.groups, state.groups);
    storage.set(STORAGE_KEYS.tags, state.tags);
    storage.set(STORAGE_KEYS.activeTab, state.activeTab);
  }, [state.aiSettings, state.connections, state.groups, state.tags, state.activeTab]);

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
      await notesApi.delete(id);
      dispatch({ type: 'DELETE_NOTE', payload: id });
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
