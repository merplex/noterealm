import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, getMonth, getYear } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';

const STORAGE_KEY = 'yearview_collapsed';
const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };

function loadCollapsed() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

export default function YearView({ date, todos, onSelectTodo, onToggleTodo }) {
  const { t, locale } = useLocale();
  const dfLocale = locale === 'en' ? enUS : th;
  const d = (useFontSize() - 1) * 2;
  const year = getYear(date);
  const currentMonth = getMonth(new Date());
  const currentYear = getYear(new Date());
  const nearestRef = useRef(null);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggleMonth = useCallback((m) => {
    setCollapsed((prev) => {
      const key = `${year}-${m}`;
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [year]);

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

  const noDateTodos = useMemo(() =>
    todos.filter((t) => !t.dueDate).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [todos]
  );

  const nearestMonth = useMemo(() => {
    if (year !== currentYear) return 0;
    for (let m = currentMonth; m < 12; m++) {
      if (monthGroups[m].total > 0) return m;
    }
    for (let m = currentMonth - 1; m >= 0; m--) {
      if (monthGroups[m].total > 0) return m;
    }
    return currentMonth;
  }, [monthGroups, currentMonth, currentYear, year]);

  useEffect(() => {
    if (nearestRef.current) {
      const calBody = nearestRef.current.closest('[data-cal-body]');
      if (calBody) {
        const top = nearestRef.current.offsetTop - calBody.offsetTop - 50;
        calBody.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }
  }, [year]);

  return (
    <div style={styles.container}>
      <div style={{ ...styles.yearHeader, fontSize: 20 + d }}>{year}</div>
      {monthGroups.map(({ month, todos: mTodos, done, total }) => {
        const isCollapsed = collapsed[`${year}-${month}`];
        return (
        <div
          key={month}
          ref={month === nearestMonth ? nearestRef : null}
          style={styles.monthBlock}
        >
          <div style={{ ...styles.monthHeader, fontSize: 14 + d }} onClick={() => toggleMonth(month)}>
            <span style={{ ...styles.chevron, fontSize: 12 + d }}>{isCollapsed ? '▸' : '▾'}</span>
            <span style={styles.monthName}>
              {format(new Date(year, month, 1), 'MMMM', { locale: dfLocale })}
            </span>
            <span style={{ ...styles.monthCount, fontSize: 12 + d }}>{done}/{total}</span>
          </div>
          {!isCollapsed && mTodos.map((todo) => (
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
                  ...styles.todoTitle,
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
              <span style={{ ...styles.dateLabel, fontSize: 11 + d }}>
                {format(new Date(todo.dueDate), 'd MMM', { locale: dfLocale })}
                {todo.dueTime && ` ${todo.dueTime}`}
              </span>
            </div>
          ))}
          {!isCollapsed && total === 0 && (
            <div style={{ ...styles.emptyMonth, fontSize: 12 + d }}>{t('cal.noItems')}</div>
          )}
        </div>
        );
      })}

      {/* No-date todos */}
      {noDateTodos.length > 0 && (
        <div style={styles.monthBlock}>
          <div style={{ ...styles.monthHeader, fontSize: 14 + d }}>
            <span style={styles.monthName}>{t('cal.noDate')}</span>
            <span style={{ ...styles.monthCount, fontSize: 12 + d }}>
              {noDateTodos.filter((t) => t.done).length}/{noDateTodos.length}
            </span>
          </div>
          {noDateTodos.map((todo) => (
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
                style={{ ...styles.todoTitle, fontSize: 13 + d, textDecoration: todo.done ? 'line-through' : 'none' }}
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
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    background: '#f5f5f4',
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    textTransform: 'capitalize',
    cursor: 'pointer',
  },
  chevron: { fontSize: 12, color: C.muted, width: 12 },
  monthName: { flex: 1 },
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
  todoTitle: { flex: 1, fontSize: 13, color: C.text, cursor: 'pointer' },
  priorityTag: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 8,
    border: '1px solid',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  dateLabel: { fontSize: 11, color: C.sub, flexShrink: 0 },
  emptyMonth: {
    padding: '12px 14px',
    fontSize: 12,
    color: C.muted,
    fontStyle: 'italic',
  },
};
