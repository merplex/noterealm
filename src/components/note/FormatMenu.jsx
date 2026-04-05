import { useState, useEffect, useRef } from 'react';
import { C } from '../../constants/theme';

const FORMAT_COLORS = [
  '#dc2626', '#f97316', '#eab308', '#16a34a', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#1c1917',
];

export default function FormatMenu({ onFormat }) {
  const [open, setOpen] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const ref = useRef(null);

  // Close on tap outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowColors(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div style={styles.wrap} ref={ref}>
      <button
        style={styles.triggerBtn}
        onClick={() => setOpen(!open)}
      >
        Style
      </button>

      {open && (
        <div style={styles.dropdown}>
          <button
            style={styles.dropItem}
            onPointerDown={(e) => { e.preventDefault(); onFormat('bold'); }}
          >
            <span style={{ fontWeight: 700 }}>B</span>
            <span style={styles.dropLabel}>ตัวหนา</span>
          </button>
          <button
            style={styles.dropItem}
            onPointerDown={(e) => { e.preventDefault(); onFormat('italic'); }}
          >
            <span style={{ fontStyle: 'italic' }}>I</span>
            <span style={styles.dropLabel}>ตัวเอียง</span>
          </button>
          <button
            style={styles.dropItem}
            onPointerDown={(e) => { e.preventDefault(); onFormat('underline'); }}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
            <span style={styles.dropLabel}>ขีดเส้นใต้</span>
          </button>
          <button
            style={styles.dropItem}
            onPointerDown={(e) => { e.preventDefault(); setShowColors(!showColors); }}
          >
            <span style={styles.colorCircle} />
            <span style={styles.dropLabel}>สีตัวอักษร</span>
          </button>

          {showColors && (
            <div style={styles.colorGrid}>
              {FORMAT_COLORS.map((color) => (
                <button
                  key={color}
                  style={{ ...styles.colorDot, background: color }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onFormat('color', color);
                    setShowColors(false);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    position: 'relative',
  },
  triggerBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 500,
    color: C.text,
  },
  dropdown: {
    position: 'absolute',
    top: 34,
    left: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    minWidth: 150,
    overflow: 'hidden',
  },
  dropItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: C.font,
    color: C.text,
    textAlign: 'left',
  },
  dropLabel: {
    fontSize: 13,
    color: C.sub,
  },
  colorCircle: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'conic-gradient(#dc2626, #f97316, #eab308, #16a34a, #3b82f6, #8b5cf6, #ec4899, #dc2626)',
    border: '2px solid white',
    boxShadow: '0 0 0 1px #ddd',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 6,
    padding: '8px 14px 12px',
    borderTop: `1px solid ${C.border}`,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid white',
    cursor: 'pointer',
    boxShadow: '0 0 0 1px #ddd',
  },
};
