import { useMemo } from 'react';
import { C } from '../../constants/theme';
import { diffWords, stripHtml } from '../../utils/diff';

export default function HistorySidebar({ note, onRestore, onClose }) {
  const history = note?.history || [];
  const currentContent = stripHtml(note?.content || '');

  // Build a unified view: compare each version with the current content
  // and annotate which parts were added/deleted/modified at each version
  const diffView = useMemo(() => {
    if (history.length === 0) return null;

    // Get all version contents (oldest first)
    const versions = [...history].reverse().map((ver) => ({
      timestamp: ver.timestamp,
      content: stripHtml(ver.content || ''),
    }));

    // Compare most recent history entry (= previous content) vs current
    const prevContent = stripHtml(history[0]?.content || '');
    const segments = diffWords(prevContent, currentContent);

    return { segments, versions };
  }, [history, currentContent]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sidebar} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📋 ประวัติการแก้ไข</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Version list */}
        <div style={styles.versionList}>
          {history.length === 0 && (
            <p style={styles.empty}>ยังไม่มีประวัติการแก้ไข</p>
          )}
          {history.map((ver, i) => (
            <div key={i} style={styles.versionItem}>
              <span style={styles.versionDot} />
              <span style={styles.versionTime}>
                {new Date(ver.timestamp).toLocaleString('th-TH')}
              </span>
              <button style={styles.restoreBtn} onClick={() => onRestore?.(ver)}>
                ↩ กู้คืน
              </button>
            </div>
          ))}
        </div>

        {/* Diff content view */}
        {diffView && (
          <div style={styles.diffContent}>
            <div style={styles.diffLabel}>เปรียบเทียบกับ version ปัจจุบัน</div>
            <div style={styles.diffBody}>
              {diffView.segments.map((seg, i) => {
                if (seg.type === 'same') {
                  return <span key={i}>{seg.text}</span>;
                }
                if (seg.type === 'del') {
                  return (
                    <span key={i} style={styles.diffDel}>
                      {seg.text}
                    </span>
                  );
                }
                if (seg.type === 'add') {
                  return (
                    <span key={i} style={styles.diffAdd}>
                      {seg.text}
                    </span>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.2)',
    zIndex: 300,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '85%',
    maxWidth: 360,
    height: '100%',
    background: C.sidebar,
    borderLeft: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: `1px solid ${C.border}`,
  },
  title: { fontSize: 16, fontWeight: 600, color: C.text },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: C.muted,
  },
  versionList: {
    padding: '10px 16px',
    borderBottom: `1px solid ${C.border}`,
  },
  versionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: C.amber,
    flexShrink: 0,
  },
  versionTime: {
    flex: 1,
    fontSize: 12,
    color: C.sub,
  },
  restoreBtn: {
    background: 'none',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    cursor: 'pointer',
    color: C.amber,
    fontFamily: C.font,
  },
  empty: { color: C.muted, textAlign: 'center', padding: 20, fontSize: 13 },
  diffContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
  },
  diffLabel: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 8,
  },
  diffBody: {
    fontSize: 14,
    lineHeight: 1.8,
    fontFamily: C.font,
    color: C.text,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  diffDel: {
    color: '#dc2626',
    textDecoration: 'line-through',
    background: '#fef2f2',
    borderRadius: 2,
    padding: '0 2px',
  },
  diffAdd: {
    color: C.text,
    background: '#e5e5e5',
    borderRadius: 2,
    padding: '0 2px',
  },
};
