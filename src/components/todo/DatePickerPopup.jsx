import { useState } from 'react';
import { C } from '../../constants/theme';

const QUICK_PICKS = [
  { label: 'วันนี้', days: 0 },
  { label: 'พรุ่งนี้', days: 1 },
  { label: 'อาทิตย์หน้า', days: 7 },
  { label: '2 อาทิตย์', days: 14 },
  { label: 'เดือนหน้า', months: 1 },
  { label: '2 เดือน', months: 2 },
  { label: '3 เดือน', months: 3 },
  { label: 'ครึ่งปี', months: 6 },
  { label: 'ปีหน้า', months: 12 },
];

function calcDate(pick) {
  const d = new Date();
  if (pick.months) d.setMonth(d.getMonth() + pick.months);
  else d.setDate(d.getDate() + (pick.days || 0));
  return d.toISOString().split('T')[0];
}

export default function DatePickerPopup({ dueDate, dueTime, onSave, onCancel }) {
  const [date, setDate] = useState(dueDate || '');
  const [time, setTime] = useState(dueTime || '');

  const handleSave = () => onSave(date || undefined, time || undefined);

  return (
    <div style={styles.overlay} onClick={handleSave}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>ตั้งวันครบกำหนด</div>

        <div style={styles.quickGrid}>
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick.label}
              style={{
                ...styles.quickBtn,
                background: date === calcDate(pick) ? C.amber : C.white,
                color: date === calcDate(pick) ? C.white : C.text,
                borderColor: date === calcDate(pick) ? C.amber : C.border,
              }}
              onClick={() => setDate(calcDate(pick))}
            >
              {pick.label}
            </button>
          ))}
          <button
            style={{
              ...styles.quickBtn,
              background: !date ? '#f0f0f0' : C.white,
              color: C.sub,
              borderColor: C.border,
            }}
            onClick={() => { setDate(''); setTime(''); }}
          >
            ไม่ระบุ
          </button>
        </div>

        <div style={styles.inputRow}>
          <div style={styles.field}>
            <label style={styles.label}>วันที่</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>เวลา</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onCancel}>ยกเลิก</button>
          <button style={styles.saveBtn} onClick={handleSave}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

export { QUICK_PICKS, calcDate };

const styles = {
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
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
    marginBottom: 12,
    fontFamily: C.font,
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    marginBottom: 14,
  },
  quickBtn: {
    padding: '7px 4px',
    borderRadius: 16,
    border: '1px solid',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    fontWeight: 500,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 14,
  },
  field: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: C.sub,
    marginBottom: 4,
    display: 'block',
    fontFamily: C.font,
  },
  input: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontFamily: C.font,
    outline: 'none',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
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
};
