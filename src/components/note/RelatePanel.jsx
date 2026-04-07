import { useMemo } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export default function RelatePanel({ note, onNavigate }) {
  const { state } = useApp();

  const relates = useMemo(() => {
    if (!note) return [];
    const myRefs = new Set(note.refs || []);
    return state.notes.filter(
      (n) => n.id !== note.id && !n.deletedAt &&
        (myRefs.has(n.id) || (n.refs || []).includes(note.id))
    );
  }, [note, state.notes]);

  if (relates.length === 0) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.section}>
        {relates.map((n) => (
          <button
            key={n.id}
            style={styles.chip}
            onClick={() => onNavigate?.(n)}
          >
            🔗 {n.title || 'Untitled'}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    padding: '8px 16px',
    borderBottom: `1px solid ${C.border}`,
    background: C.sidebar,
  },
  section: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 8,
    border: `1px solid #f59e0b`,
    background: '#fef3c7',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
  },
};
