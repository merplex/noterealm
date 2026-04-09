import { useState } from 'react';
import { C } from '../../constants/theme';
import { useLocale } from '../../utils/useLocale';
import { useFontSize } from '../../utils/useFontSize';

const QUICK_PICK_KEYS = [
  { key: 'datePicker.today', days: 0 },
  { key: 'datePicker.tomorrow', days: 1 },
  { key: 'datePicker.nextWeek', days: 7 },
  { key: 'datePicker.twoWeeks', days: 14 },
  { key: 'datePicker.nextMonth', months: 1 },
  { key: 'datePicker.twoMonths', months: 2 },
  { key: 'datePicker.threeMonths', months: 3 },
  { key: 'datePicker.halfYear', months: 6 },
  { key: 'datePicker.nextYear', months: 12 },
];

function calcDate(pick) {
  const d = new Date();
  if (pick.months) d.setMonth(d.getMonth() + pick.months);
  else d.setDate(d.getDate() + (pick.days || 0));
  return d.toISOString().split('T')[0];
}

// QUICK_PICKS export สำหรับ TodoEditor (ใช้ key แทน label)
const QUICK_PICKS = QUICK_PICK_KEYS;

export default function DatePickerPopup({ dueDate, dueTime, onSave, onCancel }) {
  const { t, locale } = useLocale();
  const fd = (useFontSize() - 1) * 2;
  const [date, setDate] = useState(dueDate || '');
  const [time, setTime] = useState(dueTime || '');
  const langAttr = locale === 'en' ? 'en' : 'th';

  const handleSave = () => onSave(date || undefined, time || undefined);

  return (
    <div style={styles.overlay} onClick={handleSave}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.title, fontSize: 15 + fd }}>{t('datePicker.title')}</div>

        <div style={styles.quickGrid}>
          {QUICK_PICK_KEYS.map((pick) => (
            <button
              key={pick.key}
              style={{
                ...styles.quickBtn,
                fontSize: 12 + fd,
                background: date === calcDate(pick) ? C.amber : C.white,
                color: date === calcDate(pick) ? C.white : C.text,
                borderColor: date === calcDate(pick) ? C.amber : C.border,
              }}
              onClick={() => setDate(calcDate(pick))}
            >
              {t(pick.key)}
            </button>
          ))}
          <button
            style={{
              ...styles.quickBtn,
              fontSize: 12 + fd,
              background: !date ? '#f0f0f0' : C.white,
              color: C.sub,
              borderColor: C.border,
            }}
            onClick={() => { setDate(''); setTime(''); }}
          >
            {t('todoEditor.noDate')}
          </button>
        </div>

        <div style={styles.inputRow}>
          <div style={styles.field}>
            <label style={{ ...styles.label, fontSize: 11 + fd }}>{t('datePicker.date')}</label>
            <input
              type="date"
              lang={langAttr}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...styles.input, fontSize: 13 + fd }}
            />
          </div>
          <div style={styles.field}>
            <label style={{ ...styles.label, fontSize: 11 + fd }}>{t('todoEditor.time')}</label>
            <input
              type="time"
              lang={langAttr}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ ...styles.input, fontSize: 13 + fd }}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button style={{ ...styles.cancelBtn, fontSize: 13 + fd }} onClick={onCancel}>{t('common.cancel')}</button>
          <button style={{ ...styles.saveBtn, fontSize: 13 + fd }} onClick={handleSave}>{t('common.save')}</button>
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
