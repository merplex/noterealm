import { useState } from 'react';
import { C } from '../../constants/theme';

const FORMAT_COLORS = [
  '#dc2626', '#f97316', '#eab308', '#16a34a', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#1c1917',
];

export default function FormatMenu({ onFormat }) {
  const [showColors, setShowColors] = useState(false);

  const items = [
    { label: 'B', action: 'bold', style: { fontWeight: 700 } },
    { label: 'I', action: 'italic', style: { fontStyle: 'italic' } },
    { label: 'S', action: 'strike', style: { textDecoration: 'line-through' } },
    { label: '<>', action: 'code', style: { fontFamily: 'monospace', fontSize: 12 } },
  ];

  return (
    <div style={styles.wrap}>
      {items.map((item) => (
        <button
          key={item.action}
          style={{ ...styles.btn, ...item.style }}
          onClick={() => onFormat(item.action)}
        >
          {item.label}
        </button>
      ))}
      <div style={{ position: 'relative' }}>
        <button
          style={{ ...styles.btn, fontSize: 12 }}
          onClick={() => setShowColors(!showColors)}
        >
          𝐀 ▾
        </button>
        {showColors && (
          <div style={styles.colorGrid}>
            {FORMAT_COLORS.map((color) => (
              <button
                key={color}
                style={{ ...styles.colorDot, background: color }}
                onClick={() => {
                  onFormat('color', color);
                  setShowColors(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.white,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    color: C.text,
  },
  colorGrid: {
    position: 'absolute',
    top: 34,
    right: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 6,
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 4,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2px solid white',
    cursor: 'pointer',
    boxShadow: '0 0 0 1px #ddd',
  },
};
