import { format, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export default function DayView({ date, todos, onSelectTodo, onReschedule, onLinkNote }) {
  const { dispatch } = useApp();

  const dayTodos = todos
    .filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), date))
    .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));

  const handleToggle = (todo) => {
    dispatch({ type: 'UPDATE_TODO', payload: { ...todo, done: !todo.done } });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {format(date, 'EEEE d MMMM yyyy', { locale: th })}
      </div>

      {dayTodos.length === 0 ? (
        <p style={styles.empty}>ไม่มีรายการในวันนี้</p>
      ) : (
        dayTodos.map((todo) => (
          <div key={todo.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={{
                ...styles.priorityDot,
                background: PRIORITY_COLORS[todo.priority],
              }} />
              <span style={{
                ...styles.title,
                textDecoration: todo.done ? 'line-through' : 'none',
              }}>
                {todo.title}
              </span>
              {todo.dueTime && <span style={styles.time}>{todo.dueTime}</span>}
            </div>

            {todo.note && <p style={styles.note}>{todo.note}</p>}

            <div style={styles.actions}>
              <button
                style={styles.actionBtn}
                onClick={() => handleToggle(todo)}
              >
                {todo.done ? '↩ ยกเลิก' : '✅ เสร็จ'}
              </button>
              <button
                style={styles.actionBtn}
                onClick={() => onLinkNote?.(todo)}
              >
                📝 เพิ่มใน Note
              </button>
              <button
                style={styles.actionBtn}
                onClick={() => onReschedule?.(todo)}
              >
                🗓 เลื่อน
              </button>
              <button
                style={styles.actionBtn}
                onClick={() => onSelectTodo?.(todo)}
              >
                🔗 Link Note
              </button>
            </div>
          </div>
        ))
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
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  title: { flex: 1, fontSize: 15, fontWeight: 500, color: C.text },
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
};
