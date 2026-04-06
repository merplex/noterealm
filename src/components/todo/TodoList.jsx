import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import TodoItem from './TodoItem';
import TodoEditor from './TodoEditor';
import DatePickerPopup from './DatePickerPopup';

const SECTIONS = [
  { key: 'urgent', label: '🔴 เร่งด่วน' },
  { key: 'high', label: '🟠 สำคัญ' },
  { key: 'normal', label: '🟡 ปกติ' },
  { key: 'low', label: '⚪ ต่ำ' },
];

const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };

export default function TodoList({ searchText }) {
  const { state, actions } = useApp();
  const isGrid = state.viewMode === 'grid';
  const [collapsed, setCollapsed] = useState({});
  const [editingTodo, setEditingTodo] = useState(null);
  const [datePickTodo, setDatePickTodo] = useState(null);
  const [quickAdd, setQuickAdd] = useState('');

  const filteredTodos = useMemo(() => {
    let todos = [...state.todos];
    if (searchText) {
      const q = searchText.toLowerCase();
      todos = todos.filter(
        (t) => t.title?.toLowerCase().includes(q) || t.note?.toLowerCase().includes(q)
      );
    }
    // Sort: overdue first, then no-date, then today/future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    todos.sort((a, b) => {
      const aDate = a.dueDate ? new Date(a.dueDate) : null;
      const bDate = b.dueDate ? new Date(b.dueDate) : null;
      const aOverdue = aDate && aDate < today;
      const bOverdue = bDate && bDate < today;
      const aNoDate = !aDate;
      const bNoDate = !bDate;
      // Group order: overdue=0, no-date=1, future=2
      const aGroup = aOverdue ? 0 : aNoDate ? 1 : 2;
      const bGroup = bOverdue ? 0 : bNoDate ? 1 : 2;
      if (aGroup !== bGroup) return aGroup - bGroup;
      // Within overdue/future: earliest date first
      if (aDate && bDate) return aDate - bDate;
      return 0;
    });
    return todos;
  }, [state.todos, searchText]);

  const toggleCollapse = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggle = (todo) => {
    const newDone = !todo.done;
    actions.updateTodo({
      ...todo,
      done: newDone,
      completedAt: newDone ? new Date().toISOString() : undefined,
    }).catch(console.error);
  };

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return;
    try {
      await actions.addTodo({
        id: uuidv4(),
        title: quickAdd.trim(),
        priority: 'normal',
        done: false,
        source: 'manual',
        createdAt: new Date().toISOString(),
      });
      setQuickAdd('');
    } catch (err) {
      alert('เพิ่มไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div style={styles.container}>
      {/* Quick add bar */}
      <div style={styles.quickAdd}>
        <input
          type="text"
          placeholder="+ เพิ่ม Todo ใหม่..."
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
          style={styles.quickInput}
        />
        <button style={styles.quickBtn} onClick={handleQuickAdd}>
          เพิ่ม
        </button>
      </div>

      <div style={styles.list}>
        {isGrid ? (
          /* Grid view */
          filteredTodos.length === 0 ? (
            <div style={styles.empty}>
              {searchText ? 'ไม่พบรายการ' : 'ยังไม่มี Todo — พิมพ์ด้านบนเพื่อเพิ่ม'}
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  style={{
                    ...styles.gridCard,
                    opacity: todo.done ? 0.5 : 1,
                    borderLeftColor: PRIORITY_COLORS[todo.priority] || C.muted,
                  }}
                  onClick={() => setEditingTodo(todo)}
                >
                  <div style={styles.gridCardHeader}>
                    <button
                      style={{
                        ...styles.gridCb,
                        background: todo.done ? C.amber : 'transparent',
                        borderColor: todo.done ? C.amber : C.border,
                      }}
                      onClick={(e) => { e.stopPropagation(); handleToggle(todo); }}
                    >
                      {todo.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </button>
                    <span style={{
                      ...styles.gridTitle,
                      textDecoration: todo.done ? 'line-through' : 'none',
                    }}>{todo.title}</span>
                  </div>
                  {todo.note && <p style={styles.gridNote}>{todo.note}</p>}
                  <div style={styles.gridMeta}>
                    <span style={{
                      ...styles.gridPriority,
                      background: (PRIORITY_COLORS[todo.priority] || C.muted) + '20',
                      color: PRIORITY_COLORS[todo.priority] || C.muted,
                    }}>
                      {PRIORITY_LABELS[todo.priority] || 'ปกติ'}
                    </span>
                    <span
                      style={styles.gridDate}
                      onClick={(e) => { e.stopPropagation(); setDatePickTodo(todo); }}
                    >
                      {todo.dueDate
                        ? new Date(todo.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                        : 'ไม่ระบุ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* List view */
          <>
            {SECTIONS.map((section) => {
              const todos = filteredTodos.filter((t) => t.priority === section.key);
              if (todos.length === 0) return null;

              return (
                <div key={section.key}>
                  <button
                    style={styles.sectionHeader}
                    onClick={() => toggleCollapse(section.key)}
                  >
                    <span>{section.label}</span>
                    <span style={styles.count}>{todos.length}</span>
                    <span style={styles.chevron}>
                      {collapsed[section.key] ? '▸' : '▾'}
                    </span>
                  </button>
                  {!collapsed[section.key] &&
                    todos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={handleToggle}
                        onEdit={setEditingTodo}
                        onDateClick={setDatePickTodo}
                      />
                    ))}
                </div>
              );
            })}

            {filteredTodos.length === 0 && (
              <div style={styles.empty}>
                {searchText ? 'ไม่พบรายการ' : 'ยังไม่มี Todo — พิมพ์ด้านบนเพื่อเพิ่ม'}
              </div>
            )}
          </>
        )}
      </div>

      {datePickTodo && (
        <DatePickerPopup
          dueDate={datePickTodo.dueDate}
          dueTime={datePickTodo.dueTime}
          onSave={(date, time) => {
            actions.updateTodo({ ...datePickTodo, dueDate: date, dueTime: time }).catch(console.error);
            setDatePickTodo(null);
          }}
          onCancel={() => setDatePickTodo(null)}
        />
      )}

      {editingTodo && (
        <TodoEditor todo={editingTodo} onClose={() => setEditingTodo(null)} />
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 14px',
    background: '#f5f5f4',
    border: 'none',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    fontFamily: C.font,
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
  },
  count: {
    fontSize: 11,
    color: C.muted,
    background: C.white,
    padding: '1px 6px',
    borderRadius: 10,
  },
  chevron: { marginLeft: 'auto', color: C.muted, fontSize: 12 },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: C.muted,
    fontSize: 14,
  },
  quickAdd: {
    display: 'flex',
    gap: 8,
    padding: '10px 14px',
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
  },
  quickInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    fontFamily: C.font,
    outline: 'none',
  },
  quickBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    padding: 10,
  },
  gridCard: {
    background: C.white,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    borderLeft: '4px solid',
    padding: 10,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  gridCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
  },
  gridCb: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '2px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
    background: 'transparent',
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: C.text,
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  gridNote: {
    fontSize: 11,
    color: C.sub,
    lineHeight: 1.3,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    margin: 0,
  },
  gridMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  gridPriority: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 8,
    fontWeight: 600,
  },
  gridDate: {
    fontSize: 10,
    color: C.sub,
    cursor: 'pointer',
  },
};
