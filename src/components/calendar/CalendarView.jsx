import { useState } from 'react';
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, addYears, subYears } from 'date-fns';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
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

export default function CalendarView({ onSelectTodo }) {
  const { state, actions } = useApp();
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  const handleToggleTodo = (todo) => {
    actions.updateTodo({ ...todo, done: !todo.done }).catch(console.error);
  };

  const navigate = (dir) => {
    const fn = dir === 1
      ? { year: addYears, month: addMonths, week: addWeeks, day: addDays }
      : { year: subYears, month: subMonths, week: subWeeks, day: subDays };
    setDate(fn[view](date, 1));
  };

  const viewProps = {
    date,
    todos: state.todos,
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

      {/* Calendar content */}
      <div style={styles.body}>
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
  body: {
    flex: 1,
    overflowY: 'auto',
  },
};
