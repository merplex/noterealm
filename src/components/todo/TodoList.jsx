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

export default function TodoList({ searchText }) {
  const { state, actions } = useApp();
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
    actions.updateTodo({ ...todo, done: !todo.done }).catch(console.error);
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
            {searchText ? 'ไม่พบรายการ' : 'ยังไม่มี Todo — พิมพ์ด้านล่างเพื่อเพิ่ม'}
          </div>
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
};
