import { useMemo, useRef, useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };
const SLOT_HEIGHT = 90;
const HOURS = Array.from({ length: 12 }, (_, i) => i * 2); // 0,2,4,...,22

export default function DayView({ date, todos, onSelectTodo, onToggleTodo }) {
  const { state, actions } = useApp();
  const scrollRef = useRef(null);
  const [linkTodo, setLinkTodo] = useState(null);
  const [noteConfirm, setNoteConfirm] = useState(null);
  const [noteSearch, setNoteSearch] = useState('');

  const dayTodos = useMemo(() =>
    todos
      .filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), date))
      .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || '')),
    [todos, date]
  );

  const noDateTodos = useMemo(() =>
    todos.filter((t) => !t.dueDate).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [todos]
  );

  // Scroll to 8:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      const slot8 = SLOT_HEIGHT * 4; // hour 8 = index 4 (0,2,4,6,8)
      scrollRef.current.scrollTop = slot8;
    }
  }, [date]);

  const handleToggle = (todo) => {
    if (onToggleTodo) {
      onToggleTodo(todo);
    } else {
      const newDone = !todo.done;
      actions.updateTodo({
        ...todo,
        done: newDone,
        completedAt: newDone ? new Date().toISOString() : undefined,
      }).catch(console.error);
    }
  };

  const handleReschedule = (todo) => {
    // Import DatePickerPopup dynamically would be complex, so dispatch via onSelectTodo
    onSelectTodo?.(todo);
  };

  const handleAddToNote = async (todo) => {
    try {
      await actions.addNote({
        id: uuidv4(),
        title: todo.title,
        content: `<p>${todo.note || todo.title}</p>`,
        tags: [],
        pinned: false,
        images: [],
        aiBlocks: [],
        archived: false,
        source: 'manual',
        history: [],
        refs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNoteConfirm(null);
    } catch (err) {
      alert('เพิ่มไม่สำเร็จ: ' + err.message);
    }
  };

  const handleLinkNote = async (todo, noteId) => {
    try {
      await actions.updateTodo({ ...todo, linkedNoteId: noteId });
      setLinkTodo(null);
    } catch (err) {
      alert('เชื่อมต่อไม่สำเร็จ: ' + err.message);
    }
  };

  const filteredNotes = useMemo(() => {
    if (!linkTodo) return [];
    const q = noteSearch.toLowerCase();
    return state.notes.filter((n) =>
      !q || n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [linkTodo, noteSearch, state.notes]);

  const getTodoForSlot = (hour) =>
    dayTodos.filter((t) => {
      if (!t.dueTime) return false;
      const h = parseInt(t.dueTime.split(':')[0], 10);
      return h >= hour && h < hour + 2;
    });

  const unscheduledTodos = dayTodos.filter((t) => !t.dueTime);

  const renderTodoCard = (todo, compact) => (
    <div key={todo.id} style={{
      ...styles.todoCard,
      opacity: todo.done ? 0.5 : 1,
      borderLeftColor: PRIORITY_COLORS[todo.priority] || C.muted,
    }}>
      <div style={styles.todoRow}>
        <button
          style={{
            ...styles.checkbox,
            background: todo.done ? C.amber : 'transparent',
            borderColor: todo.done ? C.amber : C.border,
          }}
          onClick={() => handleToggle(todo)}
        >
          {todo.done && <span style={styles.checkMark}>✓</span>}
        </button>
        <span
          style={{ ...styles.todoTitle, textDecoration: todo.done ? 'line-through' : 'none' }}
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
        <button style={styles.rescheduleBtn} onClick={() => onSelectTodo?.(todo)} title="เลื่อน">
          🗓
        </button>
      </div>
      {todo.note && !compact && <p style={styles.todoNote}>{todo.note}</p>}
      <div style={styles.shortcutRow}>
        <button style={styles.shortcutBtn} onClick={() => setNoteConfirm(todo)}>
          📝 เพิ่มใน Note
        </button>
        <button style={styles.shortcutBtn} onClick={() => { setLinkTodo(todo); setNoteSearch(''); }}>
          🔗 Link Note
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {format(date, 'EEEE d MMMM yyyy', { locale: th })}
      </div>

      <div style={styles.timeline} ref={scrollRef}>
        {HOURS.map((hour) => {
          const slotTodos = getTodoForSlot(hour);
          return (
            <div key={hour} style={styles.slot}>
              <div style={styles.timeLabel}>
                {String(hour).padStart(2, '0')}:00
              </div>
              <div style={styles.slotContent}>
                {slotTodos.map((todo) => renderTodoCard(todo, true))}
              </div>
            </div>
          );
        })}

        {/* Unscheduled todos with date but no time */}
        {unscheduledTodos.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>ไม่ระบุเวลา</div>
            {unscheduledTodos.map((todo) => renderTodoCard(todo, false))}
          </div>
        )}

        {/* No-date todos */}
        {noDateTodos.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>ไม่ระบุวัน</div>
            {noDateTodos.map((todo) => renderTodoCard(todo, false))}
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {/* Confirm add to note popup */}
      {noteConfirm && (
        <div style={styles.overlay} onClick={() => setNoteConfirm(null)}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupTitle}>เพิ่มเป็น Note ใหม่?</div>
            <p style={styles.popupText}>
              จะสร้าง Note ใหม่จาก Todo "{noteConfirm.title}"
            </p>
            <div style={styles.popupFooter}>
              <button style={styles.cancelBtn} onClick={() => setNoteConfirm(null)}>ยกเลิก</button>
              <button style={styles.saveBtn} onClick={() => handleAddToNote(noteConfirm)}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Link note popup */}
      {linkTodo && (
        <div style={styles.overlay} onClick={() => setLinkTodo(null)}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.popupTitle}>เลือก Note เพื่อเชื่อมต่อ</div>
            <input
              style={styles.searchInput}
              placeholder="ค้นหา Note..."
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              autoFocus
            />
            <div style={styles.noteList}>
              {filteredNotes.length === 0 ? (
                <p style={styles.emptyList}>ไม่พบ Note</p>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      ...styles.noteItem,
                      background: linkTodo.linkedNoteId === note.id ? C.amberLight : C.white,
                    }}
                    onClick={() => handleLinkNote(linkTodo, note.id)}
                  >
                    <span style={styles.noteItemTitle}>{note.title || 'ไม่มีชื่อ'}</span>
                    <span style={styles.noteItemDate}>
                      {format(new Date(note.updatedAt || note.createdAt), 'd MMM', { locale: th })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={styles.popupFooter}>
              <button style={styles.cancelBtn} onClick={() => setLinkTodo(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    fontSize: 16,
    fontWeight: 600,
    color: C.text,
    textAlign: 'center',
    padding: '10px 0',
    flexShrink: 0,
  },
  timeline: {
    flex: 1,
    overflowY: 'auto',
  },
  slot: {
    display: 'flex',
    minHeight: SLOT_HEIGHT,
    borderBottom: `1px solid ${C.border}`,
  },
  timeLabel: {
    width: 52,
    flexShrink: 0,
    fontSize: 12,
    color: C.sub,
    fontWeight: 500,
    padding: '6px 6px 0',
    textAlign: 'right',
    borderRight: `2px solid ${C.border}`,
  },
  slotContent: {
    flex: 1,
    padding: '4px 8px',
  },
  todoCard: {
    background: C.white,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    borderLeft: '4px solid',
    padding: '8px 10px',
    marginBottom: 4,
  },
  todoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
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
  checkMark: { color: 'white', fontSize: 11, fontWeight: 700 },
  todoTitle: { flex: 1, fontSize: 13, fontWeight: 500, color: C.text, cursor: 'pointer' },
  priorityTag: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 8,
    border: '1px solid',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  rescheduleBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: 2,
    flexShrink: 0,
  },
  todoNote: { fontSize: 12, color: C.sub, margin: '4px 0 0 24px', lineHeight: 1.3 },
  shortcutRow: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
    marginLeft: 24,
  },
  shortcutBtn: {
    padding: '3px 8px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.text,
  },
  section: {
    padding: '8px 14px',
    borderTop: `1px solid ${C.border}`,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: C.muted,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  // Popups
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 210,
  },
  popup: {
    background: C.bg,
    borderRadius: 14,
    width: '88%',
    maxWidth: 380,
    padding: 16,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
    marginBottom: 10,
    fontFamily: C.font,
  },
  popupText: {
    fontSize: 13,
    color: C.sub,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  popupFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  cancelBtn: {
    padding: '7px 14px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.sub,
  },
  saveBtn: {
    padding: '7px 14px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    fontFamily: C.font,
    outline: 'none',
    marginBottom: 8,
  },
  noteList: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 250,
  },
  emptyList: { fontSize: 13, color: C.muted, textAlign: 'center', padding: 16 },
  noteItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    borderRadius: 6,
    marginBottom: 2,
  },
  noteItemTitle: { flex: 1, fontSize: 13, color: C.text },
  noteItemDate: { fontSize: 11, color: C.sub },
};
