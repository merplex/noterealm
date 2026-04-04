import { useMemo } from 'react';
import { startOfWeek, addDays, isSameDay, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';

export default function WeekView({ date, todos, onSelectTodo }) {
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

      <div style={styles.grid}>
        {days.map(({ day, todos: dayTodos }) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} style={styles.column}>
              <div style={{
                ...styles.dayHeader,
                background: isToday ? C.amber : '#f5f5f4',
                color: isToday ? C.white : C.text,
              }}>
                <div style={styles.dayName}>
                  {format(day, 'EEE', { locale: th })}
                </div>
                <div style={styles.dayNum}>{format(day, 'd')}</div>
              </div>

              <div style={styles.dayBody}>
                {dayTodos.length === 0 && (
                  <span style={styles.empty}>-</span>
                )}
                {dayTodos.map((todo) => (
                  <div
                    key={todo.id}
                    style={{
                      ...styles.todoItem,
                      borderLeftColor: PRIORITY_COLORS[todo.priority] || C.muted,
                    }}
                    onClick={() => onSelectTodo?.(todo)}
                  >
                    {todo.dueTime && (
                      <span style={styles.time}>{todo.dueTime}</span>
                    )}
                    <span style={{
                      ...styles.title,
                      textDecoration: todo.done ? 'line-through' : 'none',
                    }}>
                      {todo.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '8px 6px' },
  header: {
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    padding: '8px 0',
    color: C.text,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
  },
  column: {
    background: C.white,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    minHeight: 200,
  },
  dayHeader: {
    textAlign: 'center',
    padding: '6px 4px',
    borderBottom: `1px solid ${C.border}`,
  },
  dayName: { fontSize: 11, fontWeight: 500 },
  dayNum: { fontSize: 16, fontWeight: 700 },
  dayBody: { padding: 4 },
  empty: { fontSize: 11, color: C.muted, display: 'block', textAlign: 'center', padding: 8 },
  todoItem: {
    padding: '4px 6px',
    marginBottom: 4,
    borderLeft: '3px solid',
    borderRadius: 3,
    cursor: 'pointer',
    background: '#fafaf9',
  },
  time: { fontSize: 10, color: C.sub, display: 'block' },
  title: { fontSize: 11, color: C.text, lineHeight: 1.3 },
};
