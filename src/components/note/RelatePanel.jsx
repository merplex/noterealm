import { useMemo, useRef, useState, useEffect } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

// Inject chip marquee keyframe once — translates exactly 50% for seamless loop
if (typeof document !== 'undefined' && !document.getElementById('nr-chip-marquee-css')) {
  const style = document.createElement('style');
  style.id = 'nr-chip-marquee-css';
  style.textContent = `@keyframes nr-chip-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`;
  document.head.appendChild(style);
}

function MarqueeChip({ text, onClick }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    if (wrapRef.current && textRef.current) {
      setOverflow(textRef.current.scrollWidth > wrapRef.current.clientWidth + 1);
    }
  }, [text]);

  const label = `🔗 ${text}`;

  return (
    <span ref={wrapRef} style={{ overflow: 'hidden', minWidth: 0, cursor: 'pointer', padding: '4px 8px' }} onClick={onClick}>
      <span ref={textRef} style={{
        display: 'inline-block',
        whiteSpace: 'nowrap',
        animation: overflow ? 'nr-chip-marquee 8s linear infinite' : 'none',
      }}>
        {overflow ? <>{label}{'\u00a0\u00a0'}{label}{'\u00a0\u00a0'}</> : label}
      </span>
    </span>
  );
}

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
            <MarqueeChip
              text={n.title || 'Untitled'}
              onClick={() => onNavigate?.(n)}
            />
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
    maxWidth: 150,
    flexShrink: 0,
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
