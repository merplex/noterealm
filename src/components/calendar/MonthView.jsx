import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, format,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { C, PRIORITY_COLORS } from '../../constants/theme';

const DAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };

export default function MonthView({ date, todos, onSelectDay, onSelectTodo, onToggleTodo }) {
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(
    isSameMonth(today, date) ? today : null
  );

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let day = calStart;
    while (day <= calEnd) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(day));
        day = addDays(day, 1);
      }
      rows.push(week);
    }
    return rows;
  }, [date]);

  const getTodosForDay = (day) =>
    todos.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));

  const noDateTodos = useMemo(() =>
    todos.filter((t) => !t.dueDate).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [todos]
  );

  const handleDayClick = (day) => {
    setSelectedDay(day);
    onSelectDay?.(day);
  };

  const dayTodos = selectedDay ? getTodosForDay(selectedDay) : [];

  return (
    <div>
      <div style={styles.header}>
        {format(date, 'MMMM yyyy', { locale: th })}
      </div>

      <div style={styles.grid}>
        {DAY_LABELS.map((d) => (
          <div key={d} style={styles.dayLabel}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={styles.grid}>
          {week.map((day) => {
            const dayTodoList = getTodosForDay(day);
            const isToday = isSameDay(day, today);
            const isCurrentMonth = isSameMonth(day, date);
            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <div
                key={day.toISOString()}
                style={{
                  ...styles.cell,
                  opacity: isCurrentMonth ? 1 : 0.3,
                  background: isSelected ? C.amberLight : isToday ? '#fffbeb' : 'transparent',
                  borderColor: isSelected ? C.amber : 'transparent',
                }}
                onClick={() => handleDayClick(day)}
              >
                <span style={{
                  ...styles.dayNum,
                  color: isToday ? C.amber : C.text,
                  fontWeight: isToday ? 700 : 400,
                }}>
                  {format(day, 'd')}
                </span>
                {dayTodoList.slice(0, 4).map((todo) => (
                  <div key={todo.id} style={styles.todoDot}>
                    <span style={{
                      ...styles.dot,
                      background: PRIORITY_COLORS[todo.priority] || C.muted,
                    }} />
                    <span style={styles.todoTitle}>{todo.title}</span>
                  </div>
                ))}
                {dayTodoList.length > 4 && (
                  <span style={styles.more}>+{dayTodoList.length - 4} more</span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Day Detail Panel */}
      {selectedDay && (
        <div style={styles.dayPanel}>
          <div style={styles.dayPanelHeader}>
            {format(selectedDay, 'EEEE d MMMM yyyy', { locale: th })}
          </div>
          {dayTodos.length === 0 ? (
            <p style={styles.noTodos}>ไม่มีรายการ</p>
          ) : (
            dayTodos.map((todo) => (
              <div key={todo.id} style={styles.dayTodoItem}>
                <button
                  style={{
                    ...styles.cb,
                    background: todo.done ? C.amber : 'transparent',
                    borderColor: todo.done ? C.amber : C.border,
                  }}
                  onClick={() => onToggleTodo?.(todo)}
                >
                  {todo.done && <span style={styles.cbCheck}>✓</span>}
                </button>
                <span
                  style={{
                    ...styles.dayTodoTitle,
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
                {todo.dueTime && <span style={styles.timeLabel}>{todo.dueTime}</span>}
              </div>
            ))
          )}
        </div>
      )}

      {/* No-date todos */}
      {noDateTodos.length > 0 && (
        <div style={styles.dayPanel}>
          <div style={styles.dayPanelHeader}>ไม่ระบุวัน</div>
          {noDateTodos.map((todo) => (
            <div key={todo.id} style={styles.dayTodoItem}>
              <button
                style={{
                  ...styles.cb,
                  background: todo.done ? C.amber : 'transparent',
                  borderColor: todo.done ? C.amber : C.border,
                }}
                onClick={() => onToggleTodo?.(todo)}
              >
                {todo.done && <span style={styles.cbCheck}>✓</span>}
              </button>
              <span
                style={{ ...styles.dayTodoTitle, textDecoration: todo.done ? 'line-through' : 'none' }}
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
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}

const styles = {
  header: {
    fontSize: 16,
    fontWeight: 600,
    textAlign: 'center',
    padding: '10px 0',
    color: C.text,
    textTransform: 'capitalize',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
  },
  dayLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: C.muted,
    padding: '4px 0',
    fontWeight: 500,
  },
  cell: {
    minHeight: 70,
    padding: 4,
    border: '1px solid transparent',
    borderRadius: 4,
    cursor: 'pointer',
    overflow: 'hidden',
  },
  dayNum: { fontSize: 12, display: 'block', marginBottom: 2 },
  todoDot: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  todoTitle: {
    fontSize: 10,
    color: C.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  more: {
    fontSize: 9,
    color: C.amber,
    fontWeight: 500,
  },
  dayPanel: {
    margin: '8px 14px',
    padding: 12,
    background: C.white,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
  },
  dayPanelHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    marginBottom: 8,
  },
  noTodos: { fontSize: 13, color: C.muted },
  dayTodoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    borderBottom: `1px solid ${C.border}`,
  },
  dayTodoTitle: { flex: 1, fontSize: 13, color: C.text, cursor: 'pointer' },
  timeLabel: { fontSize: 11, color: C.sub },
  priorityTag: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 8,
    border: '1px solid',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  cb: {
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
  cbCheck: { color: 'white', fontSize: 11, fontWeight: 700 },
};
