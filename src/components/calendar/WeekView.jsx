import { useMemo } from 'react';
import { startOfWeek, addDays, isSameDay, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';

export default function WeekView({ date, todos, onSelectTodo, onToggleTodo }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const today = new Date();

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const dayTodos = todos
        .filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day))
        .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));
      return { day, todos: dayTodos };
    });
  }, [weekStart, todos]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        สัปดาห์ {format(weekStart, 'd MMM', { locale: th })} -{' '}
        {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: th })}
      </div>

      <div style={styles.list}>
        {days.map(({ day, todos: dayTodos }) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} style={styles.row}>
              <div style={{
                ...styles.dayLabel,
                background: isToday ? C.amber : '#f5f5f4',
                color: isToday ? C.white : C.text,
              }}>
                <div style={styles.dayName}>{format(day, 'EEE', { locale: th })}</div>
                <div style={styles.dayNum}>{format(day, 'd')}</div>
              </div>

              <div style={styles.todosArea}>
                {dayTodos.length === 0 ? (
                  <span style={styles.empty}>-</span>
                ) : (
                  dayTodos.map((todo) => (
                    <div key={todo.id} style={styles.todoItem}>
                      <button
                        style={{
                          ...styles.checkbox,
                          background: todo.done ? C.amber : 'transparent',
                          borderColor: todo.done ? C.amber : C.border,
                        }}
                        onClick={() => onToggleTodo?.(todo)}
                      >
                        {todo.done && <span style={styles.check}>✓</span>}
                      </button>
                      <span
                        style={{
                          ...styles.priorityBar,
                          background: PRIORITY_COLORS[todo.priority] || C.muted,
                        }}
                      />
                      <span
                        style={{
                          ...styles.title,
                          textDecoration: todo.done ? 'line-through' : 'none',
                        }}
                        onClick={() => onSelectTodo?.(todo)}
                      >
                        {todo.title}
                      </span>
                      {todo.dueTime && <span style={styles.time}>{todo.dueTime}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '8px 10px' },
  header: {
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    padding: '8px 0',
    color: C.text,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  row: {
    display: 'flex',
    alignItems: 'stretch',
    background: C.white,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    minHeight: 48,
  },
  dayLabel: {
    width: 52,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 4px',
    borderRight: `1px solid ${C.border}`,
  },
  dayName: { fontSize: 11, fontWeight: 500 },
  dayNum: { fontSize: 16, fontWeight: 700 },
  todosArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '4px 8px',
    justifyContent: 'center',
  },
  empty: { fontSize: 12, color: C.muted, textAlign: 'center' },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 0',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '2px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'transparent',
  },
  check: { color: 'white', fontSize: 11, fontWeight: 700 },
  priorityBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    flexShrink: 0,
  },
  title: { flex: 1, fontSize: 13, color: C.text, cursor: 'pointer' },
  time: { fontSize: 11, color: C.sub, flexShrink: 0 },
};
