import { useState } from 'react';
import { useApp } from './context/AppContext';
import SplashScreen from './components/SplashScreen';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
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
  const [editingNote, setEditingNote] = useState(null);
  const [historyNote, setHistoryNote] = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [todoView, setTodoView] = useState('list');

  const handleNewItem = () => {
    if (state.activeTab === 'note') {
      setEditingNote({});
    } else {
      setEditingTodo({});
    }
  };

  const handleRestoreHistory = (version) => {
    if (historyNote && version) {
      dispatch({
        type: 'UPDATE_NOTE',
        payload: {
          ...historyNote,
          content: version.content,
          updatedAt: new Date().toISOString(),
        },
      });
      setHistoryNote(null);
    }
  };

  return (
    <div style={styles.app}>
      {state.showSplash && <SplashScreen />}

      <Header onNewItem={handleNewItem} onSearch={setSearchText} />

      <main style={styles.main}>
        {state.activeTab === 'note' && (
          <NoteGrid
            searchText={searchText}
            onEdit={(note) => setEditingNote(note)}
            onHistory={(note) => setHistoryNote(note)}
          />
        )}

        {state.activeTab === 'todo' && (
          <>
            <div style={styles.todoToggle}>
              <button
                style={{
                  ...styles.toggleBtn,
                  background: todoView === 'list' ? C.amber : C.white,
                  color: todoView === 'list' ? C.white : C.sub,
                }}
                onClick={() => setTodoView('list')}
              >
                📋 รายการ
              </button>
              <button
                style={{
                  ...styles.toggleBtn,
                  background: todoView === 'calendar' ? C.amber : C.white,
                  color: todoView === 'calendar' ? C.white : C.sub,
                }}
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

      <BottomNav />

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
  main: {
    flex: 1,
    overflowY: 'auto',
  },
  todoToggle: {
    display: 'flex',
    gap: 4,
    padding: '8px 14px',
    background: '#f5f5f4',
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
