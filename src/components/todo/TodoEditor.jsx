import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { QUICK_PICKS, calcDate } from './DatePickerPopup';

const PRIORITIES = [
  { key: 'urgent', label: '🔴 เร่งด่วน' },
  { key: 'high', label: '🟠 สำคัญ' },
  { key: 'normal', label: '🟡 ปกติ' },
  { key: 'low', label: '⚪ ต่ำ' },
];

export default function TodoEditor({ todo, onClose }) {
  const { actions } = useApp();
  const isNew = !todo?.id;

  const [title, setTitle] = useState(todo?.title || '');
  const [note, setNote] = useState(todo?.note || '');
  const [priority, setPriority] = useState(todo?.priority || 'normal');
  const [dueDate, setDueDate] = useState(todo?.dueDate || '');
  const [dueTime, setDueTime] = useState(todo?.dueTime || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(todo?.tags || []);

  const handleSave = async () => {
    if (!title.trim()) return;
    const data = {
      id: todo?.id || uuidv4(),
      title: title.trim(),
      note: note.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      tags,
      done: todo?.done || false,
      linkedNoteId: todo?.linkedNoteId,
      source: todo?.source || 'manual',
      createdAt: todo?.createdAt || new Date().toISOString(),
    };

    try {
      if (isNew) {
        await actions.addTodo(data);
      } else {
        await actions.updateTodo(data);
      }
      onClose();
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>{isNew ? 'สร้าง Todo' : 'แก้ไข Todo'}</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <input
            type="text"
            placeholder="ชื่อ Todo..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.titleInput}
            autoFocus
          />

          <textarea
            placeholder="รายละเอียด (ไม่บังคับ)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.noteInput}
            rows={3}
          />

          {/* Priority */}
          <label style={styles.label}>ความสำคัญ</label>
          <div style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                style={{
                  ...styles.priorityBtn,
                  background: priority === p.key ? PRIORITY_COLORS[p.key] + '20' : C.white,
                  borderColor: priority === p.key ? PRIORITY_COLORS[p.key] : C.border,
                }}
                onClick={() => setPriority(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Quick pick dates */}
          <label style={styles.label}>ครบกำหนด</label>
          <div style={styles.quickPickRow}>
            {QUICK_PICKS.map((pick) => {
              const d = calcDate(pick);
              return (
                <button
                  key={pick.label}
                  style={{
                    ...styles.quickPickBtn,
                    background: dueDate === d ? C.amber : C.white,
                    color: dueDate === d ? C.white : C.text,
                    borderColor: dueDate === d ? C.amber : C.border,
                  }}
                  onClick={() => setDueDate(d)}
                >
                  {pick.label}
                </button>
              );
            })}
            <button
              style={{
                ...styles.quickPickBtn,
                background: !dueDate ? '#f0f0f0' : C.white,
                color: C.sub,
                borderColor: C.border,
              }}
              onClick={() => { setDueDate(''); setDueTime(''); }}
            >
              ไม่ระบุ
            </button>
          </div>

          {/* Due date/time */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>วันครบกำหนด</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>เวลา</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          {/* Tags */}
          <label style={styles.label}>แท็ก</label>
          <div style={styles.tagsWrap}>
            {tags.map((tag) => (
              <span key={tag} style={styles.tag}>
                {tag}
                <button
                  style={styles.tagRemove}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              style={styles.tagInput}
              placeholder="+ แท็ก"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  setTags([...tags, tagInput.trim()]);
                  setTagInput('');
                }
              }}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>ยกเลิก</button>
          <button style={styles.saveBtn} onClick={handleSave}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: C.bg,
    borderRadius: 14,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px 10px',
    borderBottom: `1px solid ${C.border}`,
  },
  headerTitle: { fontSize: 16, fontWeight: 600, color: C.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted },
  body: { flex: 1, overflowY: 'auto', padding: 16 },
  titleInput: {
    width: '100%',
    fontSize: 16,
    fontWeight: 500,
    border: 'none',
    outline: 'none',
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
    marginBottom: 10,
  },
  noteInput: {
    width: '100%',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontFamily: C.font,
    color: C.text,
    outline: 'none',
    resize: 'none',
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: 500, color: C.sub, marginBottom: 6, display: 'block' },
  priorityRow: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  priorityBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    background: C.white,
  },
  quickPickRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 },
  quickPickBtn: {
    padding: '6px 4px',
    borderRadius: 14,
    border: '1px solid',
    fontSize: 11,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    fontFamily: C.font,
    fontWeight: 500,
  },
  row: { display: 'flex', gap: 12, marginBottom: 14 },
  field: { flex: 1 },
  input: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontFamily: C.font,
    outline: 'none',
  },
  tagsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    background: C.amberLight,
    color: C.amberDark,
  },
  tagRemove: { background: 'none', border: 'none', cursor: 'pointer', color: C.amberDark, fontSize: 14, padding: 0 },
  tagInput: { border: 'none', outline: 'none', fontSize: 12, fontFamily: C.font, width: 60, background: 'transparent' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '10px 16px',
    borderTop: `1px solid ${C.border}`,
  },
  cancelBtn: {
    padding: '7px 16px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.sub,
  },
  saveBtn: {
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
};
