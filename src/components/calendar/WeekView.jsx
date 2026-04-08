import { useMemo } from 'react';
import { startOfWeek, addDays, isSameDay, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';

const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };

export default function WeekView({ date, todos, onSelectTodo, onToggleTodo }) {
  const { t } = useLocale();
  const d = (useFontSize() - 1) * 2;
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

  const noDateTodos = useMemo(() =>
    todos.filter((t) => !t.dueDate).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [todos]
  );

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, fontSize: 14 + d }}>
        {t('cal.week')} {format(weekStart, 'd MMM', { locale: th })} -{' '}
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
                <div style={{ ...styles.dayName, fontSize: 11 + d }}>{format(day, 'EEE', { locale: th })}</div>
                <div style={{ ...styles.dayNum, fontSize: 16 + d }}>{format(day, 'd')}</div>
              </div>

              <div style={styles.todosArea}>
                {dayTodos.length === 0 ? (
                  <span style={{ ...styles.empty, fontSize: 12 + d }}>-</span>
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
                          ...styles.title,
                          fontSize: 13 + d,
                          textDecoration: todo.done ? 'line-through' : 'none',
                        }}
                        onClick={() => onSelectTodo?.(todo)}
                      >
                        {todo.title}
                      </span>
                      <span style={{
                        ...styles.priorityTag,
                        fontSize: 10 + d,
                        background: (PRIORITY_COLORS[todo.priority] || C.muted) + '20',
                        color: PRIORITY_COLORS[todo.priority] || C.muted,
                        borderColor: PRIORITY_COLORS[todo.priority] || C.muted,
                      }}>
                        {t(`priority.${todo.priority}`) || t('priority.normal')}
                      </span>
                      {todo.dueTime && <span style={{ ...styles.time, fontSize: 11 + d }}>{todo.dueTime}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {noDateTodos.length > 0 && (
        <div style={styles.noDateSection}>
          <div style={{ ...styles.noDateHeader, fontSize: 12 + d }}>{t('cal.noDate')}</div>
          {noDateTodos.map((todo) => (
            <div key={todo.id} style={styles.noDateItem}>
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
                style={{ ...styles.title, fontSize: 13 + d, textDecoration: todo.done ? 'line-through' : 'none' }}
                onClick={() => onSelectTodo?.(todo)}
              >
                {todo.title}
              </span>
              <span style={{
                ...styles.priorityTag,
                fontSize: 10 + d,
                background: (PRIORITY_COLORS[todo.priority] || C.muted) + '20',
                color: PRIORITY_COLORS[todo.priority] || C.muted,
                borderColor: PRIORITY_COLORS[todo.priority] || C.muted,
              }}>
                {t(`priority.${todo.priority}`) || t('priority.normal')}
              </span>
            </div>
          ))}
        </div>
      )}
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
  title: { flex: 1, fontSize: 13, color: C.text, cursor: 'pointer' },
  priorityTag: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 8,
    border: '1px solid',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  time: { fontSize: 11, color: C.sub, flexShrink: 0 },
  noDateSection: {
    marginTop: 8,
    background: C.white,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  noDateItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderBottom: `1px solid ${C.border}`,
  },
  noDateHeader: {
    padding: '8px 12px',
    background: '#f5f5f4',
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    fontStyle: 'italic',
  },
};
