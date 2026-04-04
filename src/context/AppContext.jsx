import { createContext, useContext, useReducer, useEffect } from 'react';
import { storage } from '../constants/storage';
import { STORAGE_KEYS } from '../constants/providers';

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

  useEffect(() => {
    (async () => {
      const loaded = {};
      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        const val = await storage.get(storageKey);
        if (val !== null) loaded[key] = val;
      }
      dispatch({ type: 'LOAD_STATE', payload: loaded });
    })();
  }, []);

  useEffect(() => {
    if (state === initialState) return;
    const save = async () => {
      await storage.set(STORAGE_KEYS.notes, state.notes);
      await storage.set(STORAGE_KEYS.todos, state.todos);
      await storage.set(STORAGE_KEYS.tags, state.tags);
      await storage.set(STORAGE_KEYS.groups, state.groups);
      await storage.set(STORAGE_KEYS.connections, state.connections);
      await storage.set(STORAGE_KEYS.aiSettings, state.aiSettings);
      await storage.set(STORAGE_KEYS.activeTab, state.activeTab);
    };
    save();
  }, [state.notes, state.todos, state.tags, state.groups, state.connections, state.aiSettings, state.activeTab]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
