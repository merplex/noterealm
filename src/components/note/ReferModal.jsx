import { useState, useMemo } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { stripHtml } from '../../utils/diff';

const REF_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#16a34a"/><rect x="4.5" y="3" width="7" height="9" rx="1" fill="white"/><line x1="6" y1="5.5" x2="10" y2="5.5" stroke="#16a34a" stroke-width=".6"/><line x1="6" y1="7.2" x2="10" y2="7.2" stroke="#16a34a" stroke-width=".6"/><line x1="6" y1="8.9" x2="8.5" y2="8.9" stroke="#16a34a" stroke-width=".6"/></svg>')}`;

export default function ReferModal({ noteId, currentRefs = [], onSelect, onClose }) {
  const { state } = useApp();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const refSet = new Set(currentRefs);
    const others = state.notes.filter(
      (n) => n.id !== noteId && !n.deletedAt && !refSet.has(n.id)
    );
    if (!search) return others.slice(0, 20);
    const q = search.toLowerCase();
    return others.filter(
      (n) => n.title?.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q)
    );
  }, [state.notes, search, noteId, currentRefs]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}><img src={REF_ICON} width={16} height={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />อ้างอิงโน้ต</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <input
          type="text"
          placeholder="ค้นหาโน้ต..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.input}
          autoFocus
        />
        <div style={styles.list}>
          {filtered.map((note) => (
            <button
              key={note.id}
              style={styles.item}
              onClick={() => onSelect(note)}
            >
              <span style={styles.itemTitle}>{note.title || 'Untitled'}</span>
              <span style={styles.itemPreview}>
                {stripHtml(note.content).slice(0, 60)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p style={{ padding: 20, color: C.muted, textAlign: 'center' }}>
              ไม่พบโน้ต
            </p>
          )}
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
    maxWidth: 400,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px 10px',
  },
  title: { fontSize: 16, fontWeight: 600, color: C.text },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: C.muted,
  },
  input: {
    margin: '0 16px 10px',
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    fontFamily: C.font,
    outline: 'none',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px 8px',
  },
  item: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '10px 12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 8,
    textAlign: 'left',
    fontFamily: C.font,
  },
  itemTitle: { fontSize: 14, fontWeight: 500, color: C.text },
  itemPreview: { fontSize: 12, color: C.sub, marginTop: 2 },
};
