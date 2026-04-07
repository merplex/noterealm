import { useRef } from 'react';
import { C } from '../../constants/theme';

const SOURCE_ICONS = {
  manual: '',
  line: '💬',
  email: '📧',
  telegram: '🤖',
};

export default function TodoItem({ todo, onToggle, onEdit, onDateClick, isSelecting, isSelected, onLongPress, onSelect }) {
  const longPressTimer = useRef(null);
  const pointerStart = useRef(null);
  const suppressClick = useRef(false);

  const isDeleted = !!todo.deletedAt;
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

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const handlePointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      onLongPress?.(todo);
    }, 500);
  };

  const handlePointerMove = (e) => {
    if (!pointerStart.current) return;
    if (Math.abs(e.clientX - pointerStart.current.x) > 10 || Math.abs(e.clientY - pointerStart.current.y) > 10) {
      cancelLongPress();
    }
  };

  const handlePointerUp = () => {
    cancelLongPress();
    pointerStart.current = null;
  };

  const handleContentClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (isSelecting) {
      onSelect?.(todo);
    } else {
      onEdit?.(todo);
    }
  };

  return (
    <div
      style={{
        ...styles.item,
        opacity: todo.done && !isSelecting ? 0.5 : 1,
        background: isSelected ? '#fffbeb' : 'transparent',
        outline: isSelected ? `2px solid ${C.amber}` : 'none',
        outlineOffset: -2,
      }}
    >
      {/* Selection circle หรือ Checkbox */}
      {isSelecting ? (
        <div
          style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${isSelected ? C.amber : C.border}`,
            background: isSelected ? C.amber : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onClick={() => onSelect?.(todo)}
        >
          {isSelected ? '✓' : ''}
        </div>
      ) : (
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
      )}

      {/* Content area — long-pressable */}
      <div
        style={{ ...styles.content, userSelect: 'none', WebkitUserSelect: 'none' }}
        onClick={handleContentClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(todo); }}
      >
        {isDeleted && <span style={styles.deletedBadge}>🗑 ถูกลบ</span>}
        <span
          style={{
            ...styles.title,
            textDecoration: todo.done && !isDeleted ? 'line-through' : 'none',
          }}
        >
          {todo.title}
        </span>
        {todo.note && <span style={styles.note}>{todo.note}</span>}
      </div>

      {/* Date badge — ไม่แสดงตอน selection mode */}
      {!isSelecting && (
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
      )}
    </div>
  );
}

const styles = {
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderBottom: `1px solid ${C.border}`,
    transition: 'background 0.15s',
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
  },
  check: { color: 'white', fontSize: 13, fontWeight: 700 },
  content: {
    flex: 1,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  deletedBadge: {
    fontSize: 10,
    background: '#fef2f2',
    color: '#dc2626',
    padding: '1px 6px',
    borderRadius: 4,
    marginBottom: 2,
    display: 'inline-block',
    width: 'fit-content',
  },
  title: { fontSize: 14, color: C.text, lineHeight: 1.4 },
  note: { fontSize: 12, color: C.sub, lineHeight: 1.3 },
  badges: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  dueBadge: {
    fontSize: 11, color: C.sub, background: '#f5f5f4',
    padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
  },
  overdueBadge: {
    fontSize: 11, color: '#fff', background: '#dc2626',
    padding: '2px 8px', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
  },
  noDateBadge: {
    fontSize: 11, color: C.muted, background: '#f0f0f0',
    padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontStyle: 'italic',
  },
  sourceBadge: { fontSize: 14 },
  linkBadge: { fontSize: 12 },
};
