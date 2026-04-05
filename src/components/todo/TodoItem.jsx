import { C } from '../../constants/theme';

const SOURCE_ICONS = {
  manual: '',
  line: '💬',
  email: '📧',
  telegram: '🤖',
};

export default function TodoItem({ todo, onToggle, onEdit, onDateClick }) {
  const isOverdue = todo.dueDate && (() => {
    const due = new Date(todo.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today && !todo.done;
  })();

  const dateLabel = todo.dueDate
    ? new Date(todo.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) +
      (todo.dueTime ? ` ${todo.dueTime}` : '')
    : 'ไม่ระบุ';

  const dateBadgeStyle = todo.dueDate
    ? (isOverdue ? styles.overdueBadge : styles.dueBadge)
    : styles.noDateBadge;

  return (
    <div style={{ ...styles.item, opacity: todo.done ? 0.5 : 1 }}>
      <button
        style={{
          ...styles.checkbox,
          background: todo.done ? C.amber : 'transparent',
          borderColor: todo.done ? C.amber : C.border,
        }}
        onClick={() => onToggle?.(todo)}
      >
        {todo.done && <span style={styles.check}>✓</span>}
      </button>

      <div style={styles.content} onClick={() => onEdit?.(todo)}>
        <span
          style={{
            ...styles.title,
            textDecoration: todo.done ? 'line-through' : 'none',
          }}
        >
          {todo.title}
        </span>
        {todo.note && <span style={styles.note}>{todo.note}</span>}
      </div>

      <div style={styles.badges}>
        <span
          style={dateBadgeStyle}
          onClick={(e) => { e.stopPropagation(); onDateClick?.(todo); }}
        >
          {dateLabel}
        </span>
        {todo.source && todo.source !== 'manual' && (
          <span style={styles.sourceBadge}>{SOURCE_ICONS[todo.source]}</span>
        )}
        {todo.linkedNoteId && <span style={styles.linkBadge}>🔗</span>}
      </div>
    </div>
  );
}

const styles = {
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    borderBottom: `1px solid ${C.border}`,
    transition: 'opacity 0.2s',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: '2px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  check: {
    color: 'white',
    fontSize: 13,
    fontWeight: 700,
  },
  content: {
    flex: 1,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    fontSize: 14,
    color: C.text,
    lineHeight: 1.4,
  },
  note: {
    fontSize: 12,
    color: C.sub,
    lineHeight: 1.3,
  },
  badges: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  dueBadge: {
    fontSize: 11,
    color: C.sub,
    background: '#f5f5f4',
    padding: '2px 6px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  overdueBadge: {
    fontSize: 11,
    color: '#fff',
    background: '#dc2626',
    padding: '2px 8px',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
  },
  noDateBadge: {
    fontSize: 11,
    color: C.muted,
    background: '#f0f0f0',
    padding: '2px 6px',
    borderRadius: 4,
    cursor: 'pointer',
    fontStyle: 'italic',
  },
  sourceBadge: { fontSize: 14 },
  linkBadge: { fontSize: 12 },
};
