import { useMemo, useEffect, useRef } from 'react';
import { format, getMonth, getYear } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';

export default function YearView({ date, todos, onSelectTodo, onToggleTodo }) {
  const year = getYear(date);
  const currentMonth = getMonth(new Date());
  const currentYear = getYear(new Date());
  const nearestRef = useRef(null);

  const monthGroups = useMemo(() => {
    const groups = [];
    for (let m = 0; m < 12; m++) {
      const monthTodos = todos.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return getYear(d) === year && getMonth(d) === m;
      });
      const done = monthTodos.filter((t) => t.done).length;
      groups.push({ month: m, todos: monthTodos, done, total: monthTodos.length });
    }
    return groups;
  }, [todos, year]);

  // Find nearest month with todos to scroll to
  const nearestMonth = useMemo(() => {
    if (year !== currentYear) return 0;
    // Find first month >= current month that has todos
    for (let m = currentMonth; m < 12; m++) {
      if (monthGroups[m].total > 0) return m;
    }
    // Fallback: find last month before current with todos
    for (let m = currentMonth - 1; m >= 0; m--) {
      if (monthGroups[m].total > 0) return m;
    }
    return currentMonth;
  }, [monthGroups, currentMonth, currentYear, year]);

  useEffect(() => {
    if (nearestRef.current) {
      nearestRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [year]);

  return (
    <div style={styles.container}>
      <div style={styles.yearHeader}>{year}</div>
      {monthGroups.map(({ month, todos: mTodos, done, total }) => (
        <div
          key={month}
          ref={month === nearestMonth ? nearestRef : null}
          style={styles.monthBlock}
        >
          <div style={styles.monthHeader}>
            <span style={styles.monthName}>
              {format(new Date(year, month, 1), 'MMMM', { locale: th })}
            </span>
            <span style={styles.monthCount}>{done}/{total}</span>
          </div>
          {mTodos.map((todo) => (
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
              <span style={{
                ...styles.dot,
                background: PRIORITY_COLORS[todo.priority] || C.muted,
              }} />
              <span
                style={{
                  ...styles.todoTitle,
                  textDecoration: todo.done ? 'line-through' : 'none',
                }}
                onClick={() => onSelectTodo?.(todo)}
              >
                {todo.title}
              </span>
              <span style={styles.dateLabel}>
                {format(new Date(todo.dueDate), 'd MMM', { locale: th })}
              </span>
            </div>
          ))}
          {total === 0 && (
            <div style={styles.emptyMonth}>ไม่มีรายการ</div>
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: { padding: '8px 14px' },
  yearHeader: {
    fontSize: 20,
    fontWeight: 700,
    color: C.text,
    textAlign: 'center',
    padding: '10px 0',
  },
  monthBlock: {
    marginBottom: 10,
    background: C.white,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  monthHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#f5f5f4',
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    textTransform: 'capitalize',
  },
  monthName: {},
  monthCount: {
    fontSize: 12,
    color: C.sub,
    background: C.white,
    padding: '2px 10px',
    borderRadius: 10,
    fontWeight: 600,
  },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderBottom: `1px solid ${C.border}`,
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
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  todoTitle: { flex: 1, fontSize: 13, color: C.text, cursor: 'pointer' },
  dateLabel: { fontSize: 11, color: C.sub },
  emptyMonth: {
    padding: '12px 14px',
    fontSize: 12,
    color: C.muted,
    fontStyle: 'italic',
  },
};
