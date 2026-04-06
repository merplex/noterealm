import { useState } from 'react';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import NoteGrid from './components/note/NoteGrid';
import NoteEditor from './components/note/NoteEditor';
import HistorySidebar from './components/note/HistorySidebar';
import TodoList from './components/todo/TodoList';
import TodoEditor from './components/todo/TodoEditor';
import CalendarView from './components/calendar/CalendarView';
import { C } from './constants/theme';

export default function App() {
  const { state, dispatch } = useApp();
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [historyNote, setHistoryNote] = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [todoView, setTodoView] = useState('list');

  const handleAddNote = () => setEditingNote({});

  const handleAddTodo = () => {
    // Switch to todo tab then open editor
    dispatch({ type: 'SET_TAB', payload: 'todo' });
    setEditingTodo({});
  };

  const handleRestoreHistory = (version) => {
    if (historyNote && version) {
      dispatch({
        type: 'UPDATE_NOTE',
        payload: { ...historyNote, content: version.content, updatedAt: new Date().toISOString() },
      });
      setHistoryNote(null);
    }
  };

  const isNote = state.activeTab === 'note';

  return (
    <div style={styles.app}>
      <Header
        onSidebar={() => setShowSidebar(true)}
        onSearch={setSearchText}
        onSettings={() => setShowSettings(true)}
        onSelectNote={(note) => {
          dispatch({ type: 'SET_TAB', payload: 'note' });
          setEditingNote(note);
        }}
        onSelectTodo={(todo) => {
          dispatch({ type: 'SET_TAB', payload: 'todo' });
          setTodoView('list');
          setEditingTodo(todo);
        }}
      />

      <main style={styles.main}>
        {isNote ? (
          <NoteGrid
            searchText={searchText}
            activeFilter={activeFilter}
            onEdit={(note) => setEditingNote(note)}
            onHistory={(note) => setHistoryNote(note)}
          />
        ) : (
          <>
            <div style={styles.todoToggle}>
              <button
                style={{ ...styles.toggleBtn, background: todoView === 'list' ? C.amber : C.white, color: todoView === 'list' ? C.white : C.sub }}
                onClick={() => setTodoView('list')}
              >
                📋 รายการ
              </button>
              <button
                style={{ ...styles.toggleBtn, background: todoView === 'calendar' ? C.amber : C.white, color: todoView === 'calendar' ? C.white : C.sub }}
                onClick={() => setTodoView('calendar')}
              >
                📅 ปฏิทิน
              </button>
            </div>
            {todoView === 'list' ? (
              <TodoList searchText={searchText} />
            ) : (
              <CalendarView onSelectTodo={(todo) => setEditingTodo(todo)} />
            )}
          </>
        )}
      </main>

      {/* Bottom nav - left */}
      <div style={styles.bottomNav}>
        <button
          style={{ ...styles.navBtn, background: isNote ? C.amber : 'rgba(255,255,255,0.85)' }}
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'note' })}
          title="โน้ต"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isNote ? '#fff' : C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </button>
        <button
          style={{ ...styles.navBtn, background: !isNote ? C.amber : 'rgba(255,255,255,0.85)' }}
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'todo' })}
          title="ปฏิทิน"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={!isNote ? '#fff' : C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
      </div>

      {/* FAB buttons - right */}
      <div style={styles.fabs}>
        <button style={{ ...styles.fab, ...styles.fabNote }} onClick={handleAddNote} title="เพิ่ม Note">
          <span style={{ fontSize: 16, fontWeight: 700 }}>+Note</span>
        </button>
        <button style={{ ...styles.fab, ...styles.fabTodo }} onClick={handleAddTodo} title="เพิ่ม Todo">
          <span style={{ fontSize: 16, fontWeight: 700 }}>+Todo</span>
        </button>
      </div>

      {/* Sidebar drawer */}
      {showSidebar && (
        <Sidebar
          onClose={() => setShowSidebar(false)}
          activeFilter={activeFilter}
          onFilterTag={setActiveFilter}
          onFilterGroup={setActiveFilter}
        />
      )}

      {/* Settings bottom sheet */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* Modals */}
      {editingNote !== null && (
        <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} />
      )}
      {editingTodo !== null && (
        <TodoEditor todo={editingTodo} onClose={() => setEditingTodo(null)} />
      )}
      {historyNote && (
        <HistorySidebar
          note={historyNote}
          onRestore={handleRestoreHistory}
          onClose={() => setHistoryNote(null)}
        />
      )}
    </div>
  );
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: C.bg,
    maxWidth: 480,
    margin: '0 auto',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0,0,0,0.06)',
  },
  main: { flex: 1, overflowY: 'auto', paddingBottom: 80 },
  fabs: {
    position: 'fixed',
    bottom: 24,
    right: 'max(16px, calc((100vw - 480px) / 2 + 16px))',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    zIndex: 60,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    fontSize: 22,
    fontWeight: 300,
  },
  fabNote: { background: C.amber, color: C.text, minWidth: 80, borderRadius: 26, width: 'auto', padding: '0 16px' },
  fabTodo: { background: '#1e3a5f', color: C.white, minWidth: 80, borderRadius: 26, width: 'auto', padding: '0 16px' },
  bottomNav: {
    position: 'fixed',
    bottom: 24,
    left: 'max(16px, calc((100vw - 480px) / 2 + 16px))',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    zIndex: 60,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  },
  todoToggle: {
    display: 'flex',
    gap: 4,
    padding: '8px 14px',
    background: '#f5f5f4',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  toggleBtn: {
    flex: 1,
    padding: '8px 0',
    borderRadius: 8,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
    transition: 'all 0.15s',
  },
};
