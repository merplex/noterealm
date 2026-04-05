import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };

export default function DayView({ date, todos, onSelectTodo, onReschedule, onLinkNote, onToggleTodo }) {
  const { dispatch } = useApp();

  const dayTodos = todos
    .filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), date))
    .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));

  const noDateTodos = useMemo(() =>
    todos.filter((t) => !t.dueDate).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [todos]
  );

  const handleToggle = (todo) => {
    if (onToggleTodo) {
      onToggleTodo(todo);
    } else {
      const newDone = !todo.done;
      dispatch({ type: 'UPDATE_TODO', payload: { ...todo, done: newDone, completedAt: newDone ? new Date().toISOString() : undefined } });
    }
  };

  const renderTodo = (todo) => (
    <div key={todo.id} style={styles.card}>
      <div style={styles.cardHeader}>
        <button
          style={{
            ...styles.checkbox,
            background: todo.done ? C.amber : 'transparent',
            borderColor: todo.done ? C.amber : C.border,
          }}
          onClick={() => handleToggle(todo)}
        >
          {todo.done && <span style={styles.checkMark}>✓</span>}
        </button>
        <span
          style={{
            ...styles.title,
            textDecoration: todo.done ? 'line-through' : 'none',
          }}
          onClick={() => onSelectTodo?.(todo)}
        >
          {todo.title}
        </span>
        <span style={{
          ...styles.priorityTag,
          background: (PRIORITY_COLORS[todo.priority] || C.muted) + '20',
          color: PRIORITY_COLORS[todo.priority] || C.muted,
          borderColor: PRIORITY_COLORS[todo.priority] || C.muted,
        }}>
          {PRIORITY_LABELS[todo.priority] || 'ปกติ'}
        </span>
        {todo.dueTime && <span style={styles.time}>{todo.dueTime}</span>}
      </div>

      {todo.note && <p style={styles.note}>{todo.note}</p>}

      <div style={styles.actions}>
        <button style={styles.actionBtn} onClick={() => handleToggle(todo)}>
          {todo.done ? '↩ ยกเลิก' : '✅ เสร็จ'}
        </button>
        <button style={styles.actionBtn} onClick={() => onLinkNote?.(todo)}>
          📝 เพิ่มใน Note
        </button>
        <button style={styles.actionBtn} onClick={() => onReschedule?.(todo)}>
          🗓 เลื่อน
        </button>
        <button style={styles.actionBtn} onClick={() => onSelectTodo?.(todo)}>
          🔗 Link Note
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {format(date, 'EEEE d MMMM yyyy', { locale: th })}
      </div>

      {dayTodos.length === 0 ? (
        <p style={styles.empty}>ไม่มีรายการในวันนี้</p>
      ) : (
        dayTodos.map(renderTodo)
      )}

      {noDateTodos.length > 0 && (
        <>
          <div style={styles.noDateHeader}>ไม่ระบุวัน</div>
          {noDateTodos.map(renderTodo)}
        </>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '8px 14px' },
  header: {
    fontSize: 16,
    fontWeight: 600,
    color: C.text,
    textAlign: 'center',
    padding: '10px 0',
  },
  empty: { textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 },
  card: {
    background: C.white,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    border: '2px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'transparent',
  },
  checkMark: { color: 'white', fontSize: 12, fontWeight: 700 },
  title: { flex: 1, fontSize: 15, fontWeight: 500, color: C.text, cursor: 'pointer' },
  priorityTag: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 8,
    border: '1px solid',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  time: { fontSize: 12, color: C.sub },
  note: { fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.4 },
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.text,
  },
  noDateHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: C.muted,
    padding: '12px 0 6px',
    fontStyle: 'italic',
  },
};
