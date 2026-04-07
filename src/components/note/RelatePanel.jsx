import { useMemo } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export default function RelatePanel({ note, onNavigate, onRemove }) {
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
          <span key={n.id} style={styles.chip}>
            <span style={styles.chipLabel} onClick={() => onNavigate?.(n)}>
              🔗 {(n.title || 'Untitled').slice(0, 10)}{(n.title || '').length > 10 ? '…' : ''}
            </span>
            {onRemove && (
              <button style={styles.chipRemove} onClick={() => onRemove(n.id)}>✕</button>
            )}
          </span>
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
    flexWrap: 'nowrap',
    gap: 6,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 2,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 8,
    border: `1px solid #f59e0b`,
    background: '#fef3c7',
    fontSize: 12,
    fontFamily: C.font,
    overflow: 'hidden',
  },
  chipLabel: {
    padding: '4px 8px',
    cursor: 'pointer',
  },
  chipRemove: {
    padding: '4px 7px',
    background: 'none',
    border: 'none',
    borderLeft: '1px solid #f59e0b',
    cursor: 'pointer',
    fontSize: 10,
    color: '#92400e',
    fontFamily: C.font,
    lineHeight: 1,
  },
};
