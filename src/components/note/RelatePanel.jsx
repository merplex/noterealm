import { useMemo } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { findSemanticRelates } from '../../utils/semanticRelate';

export default function RelatePanel({ note, onNavigate }) {
  const { state } = useApp();

  const relates = useMemo(() => {
    if (!note) return { direct: [], semantic: [] };

    // Direct relates: notes that reference each other via [[noteId:...]]
    const refPattern = /\[\[([^:]+):/g;
    const myRefs = new Set();
    let match;
    while ((match = refPattern.exec(note.content || '')) !== null) {
      myRefs.add(match[1]);
    }

    const direct = state.notes.filter(
      (n) =>
        n.id !== note.id &&
        (myRefs.has(n.id) || (n.content || '').includes(`[[${note.id}:`))
    );

    // Semantic relates: keyword overlap
    const semantic = findSemanticRelates(note, state.notes).slice(0, 3);

    return { direct, semantic };
  }, [note, state.notes]);

  if (relates.direct.length === 0 && relates.semantic.length === 0) return null;

  return (
    <div style={styles.panel}>
      {relates.direct.length > 0 && (
        <div style={styles.section}>
          {relates.direct.map((n) => (
            <button
              key={n.id}
              style={{ ...styles.chip, background: '#fef3c7', borderColor: '#f59e0b' }}
              onClick={() => onNavigate?.(n)}
            >
              🔗 {n.title || 'Untitled'}
            </button>
          ))}
        </div>
      )}
      {relates.semantic.length > 0 && (
        <div style={styles.section}>
          {relates.semantic.map((n) => (
            <button
              key={n.id}
              style={{ ...styles.chip, background: '#ede9fe', borderColor: '#8b5cf6' }}
              onClick={() => onNavigate?.(n)}
            >
              🔮 {n.title || 'Untitled'}
            </button>
          ))}
        </div>
      )}
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
    marginBottom: 4,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    background: 'none',
  },
};
