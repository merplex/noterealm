import { useMemo, useRef, useState, useEffect } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useFontSize } from '../../utils/useFontSize';

const REF_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#16a34a"/><rect x="4.5" y="3" width="7" height="9" rx="1" fill="white"/><line x1="6" y1="5.5" x2="10" y2="5.5" stroke="#16a34a" stroke-width=".6"/><line x1="6" y1="7.2" x2="10" y2="7.2" stroke="#16a34a" stroke-width=".6"/><line x1="6" y1="8.9" x2="8.5" y2="8.9" stroke="#16a34a" stroke-width=".6"/></svg>')}`;

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

  const label = <><img src={REF_ICON} width={12} height={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />{text}</>;

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
  const d = (useFontSize() - 1) * 2;

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
          <span key={n.id} style={{ ...styles.chip, fontSize: 12 + d }}>
            <MarqueeChip
              text={n.title || 'Untitled'}
              onClick={() => onNavigate?.(n)}
            />
            {onRemove && (
              <button style={{ ...styles.chipRemove, fontSize: 10 + d }} onClick={() => onRemove(n.id)}>✕</button>
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
