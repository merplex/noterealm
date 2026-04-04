import { useMemo } from 'react';
import { format, getMonth, getYear } from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';

export default function YearView({ date, todos, onSelectTodo }) {
  const year = getYear(date);

  const monthGroups = useMemo(() => {
    const groups = [];
    for (let m = 11; m >= 0; m--) {
      const monthTodos = todos.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return getYear(d) === year && getMonth(d) === m;
      });
      if (monthTodos.length > 0) {
        groups.push({ month: m, todos: monthTodos });
      }
    }
    return groups;
  }, [todos, year]);

  return (
    <div style={styles.container}>
      <div style={styles.yearHeader}>{year}</div>
      {monthGroups.length === 0 && (
        <p style={styles.empty}>ไม่มีรายการในปีนี้</p>
      )}
      {monthGroups.map(({ month, todos: mTodos }) => (
        <div key={month} style={styles.monthBlock}>
          <div style={styles.monthHeader}>
            {format(new Date(year, month, 1), 'MMMM', { locale: th })}
            <span style={styles.monthCount}>{mTodos.length}</span>
          </div>
          {mTodos.map((todo) => (
            <div
              key={todo.id}
              style={styles.todoItem}
              onClick={() => onSelectTodo?.(todo)}
            >
              <span style={{
                ...styles.dot,
                background: PRIORITY_COLORS[todo.priority] || C.muted,
              }} />
              <span style={{
                ...styles.todoTitle,
                textDecoration: todo.done ? 'line-through' : 'none',
              }}>
                {todo.title}
              </span>
              <span style={styles.dateLabel}>
                {format(new Date(todo.dueDate), 'd MMM', { locale: th })}
              </span>
            </div>
          ))}
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
  empty: { textAlign: 'center', color: C.muted, padding: 40 },
  monthBlock: {
    marginBottom: 16,
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
  monthCount: {
    fontSize: 11,
    color: C.muted,
    background: C.white,
    padding: '1px 8px',
    borderRadius: 10,
  },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
  },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  todoTitle: { flex: 1, fontSize: 13, color: C.text },
  dateLabel: { fontSize: 11, color: C.sub },
};
