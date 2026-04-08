import { useState } from 'react';
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, addYears, subYears } from 'date-fns';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useFontSize } from '../../utils/useFontSize';
import YearView from './YearView';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';

const VIEWS = [
  { key: 'year', label: 'ปี' },
  { key: 'month', label: 'เดือน' },
  { key: 'week', label: 'สัปดาห์' },
  { key: 'day', label: 'วัน' },
];

const PRIORITY_FILTERS = [
  { key: 'urgent', label: '🔴 เร่งด่วน' },
  { key: 'high', label: '🟠 สำคัญ' },
  { key: 'normal', label: '🟡 ปกติ' },
  { key: 'low', label: '⚪ ต่ำ' },
];

export default function CalendarView({ onSelectTodo, priorityFilter, onPriorityFilter }) {
  const { state, actions } = useApp();
  const d = (useFontSize() - 1) * 2;
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  const handleToggleTodo = (todo) => {
    const newDone = !todo.done;
    actions.updateTodo({
      ...todo,
      done: newDone,
      completedAt: newDone ? new Date().toISOString() : undefined,
    }).catch(console.error);
  };

  const navigate = (dir) => {
    const fn = dir === 1
      ? { year: addYears, month: addMonths, week: addWeeks, day: addDays }
      : { year: subYears, month: subMonths, week: subWeeks, day: subDays };
    setDate(fn[view](date, 1));
  };

  const filteredTodos = priorityFilter
    ? state.todos.filter((t) => t.priority === priorityFilter)
    : state.todos;

  const viewProps = {
    date,
    todos: filteredTodos,
    onSelectTodo,
    onToggleTodo: handleToggleTodo,
  };

  return (
    <div style={styles.container}>
      {/* Navigation + View toggle */}
      <div style={styles.topBar}>
        <button style={styles.navBtn} onClick={() => navigate(-1)}>◀</button>
        <button style={styles.todayBtn} onClick={() => setDate(new Date())}>วันนี้</button>
        <button style={styles.navBtn} onClick={() => navigate(1)}>▶</button>

        <div style={styles.viewToggle}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              style={{
                ...styles.viewBtn,
                fontSize: 12 + d,
                background: view === v.key ? C.amber : C.white,
                color: view === v.key ? C.white : C.sub,
              }}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority filter chips */}
      <div style={styles.filterRow}>
        {PRIORITY_FILTERS.map((f) => {
          const active = priorityFilter === f.key;
          return (
            <button
              key={f.key}
              style={{
                ...styles.filterChip,
                fontSize: 12 + d,
                background: active ? C.amber : C.white,
                color: active ? C.white : C.sub,
                borderColor: active ? C.amber : C.border,
              }}
              onClick={() => onPriorityFilter?.(active ? null : f.key)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Calendar content */}
      <div style={styles.body} data-cal-body>
        {view === 'year' && <YearView {...viewProps} />}
        {view === 'month' && <MonthView {...viewProps} />}
        {view === 'week' && <WeekView {...viewProps} />}
        {view === 'day' && <DayView {...viewProps} />}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderBottom: `1px solid ${C.border}`,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    padding: '5px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.amber,
    fontWeight: 600,
  },
  viewToggle: {
    display: 'flex',
    gap: 2,
    marginLeft: 'auto',
    background: '#f5f5f4',
    borderRadius: 8,
    padding: 2,
  },
  viewBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: 'none',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  filterRow: {
    display: 'flex', gap: 6, padding: '6px 14px 8px',
    overflowX: 'auto', whiteSpace: 'nowrap',
    borderBottom: `1px solid ${C.border}`,
  },
  filterChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 12px', borderRadius: 20, border: '1px solid',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: C.font, transition: 'all 0.15s', flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    paddingBottom: 80,
  },
};
