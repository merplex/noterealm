import { useState, useMemo } from 'react';
import { C } from '../../constants/theme';
import { diffWords, stripHtml } from '../../utils/diff';

export default function HistorySidebar({ note, onRestore, onClose }) {
  const history = note?.history || [];
  const currentContent = stripHtml(note?.content || '');
  const [selectedIdx, setSelectedIdx] = useState(-1); // -1 = current version

  // Build version entries: current + history
  const allVersions = useMemo(() => {
    const versions = [
      { label: 'ปัจจุบัน', timestamp: note?.updatedAt, content: currentContent, isCurrent: true },
    ];
    for (const ver of history) {
      versions.push({
        label: null,
        timestamp: ver.timestamp,
        content: stripHtml(ver.content || ''),
        isCurrent: false,
        original: ver,
      });
    }
    return versions;
  }, [history, currentContent, note?.updatedAt]);

  // Compute diff segments based on selected version
  const diffSegments = useMemo(() => {
    const selVer = allVersions[selectedIdx === -1 ? 0 : selectedIdx];
    if (!selVer) return [];

    // Find the version right before the selected one
    const prevIdx = selectedIdx === -1 ? 1 : selectedIdx + 1;
    const prevVer = allVersions[prevIdx];

    if (!prevVer) {
      // No previous version — everything in selected version is "new" (plain text)
      return [{ type: 'same', text: selVer.content }];
    }

    return diffWords(prevVer.content, selVer.content);
  }, [allVersions, selectedIdx]);

  const selectedVersion = allVersions[selectedIdx === -1 ? 0 : selectedIdx];
  const prevVersion = allVersions[(selectedIdx === -1 ? 1 : selectedIdx + 1)];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sidebar} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📋 ประวัติการแก้ไข</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Version list */}
        <div style={styles.versionList}>
          {allVersions.map((ver, i) => {
            const idx = i === 0 ? -1 : i;
            const isSelected = selectedIdx === idx;
            return (
              <div
                key={i}
                style={{
                  ...styles.versionItem,
                  background: isSelected ? C.amberLight : 'transparent',
                  borderRadius: 6,
                }}
                onClick={() => setSelectedIdx(idx)}
              >
                <span style={{
                  ...styles.versionDot,
                  background: isSelected ? C.amber : C.border,
                }} />
                <span style={{
                  ...styles.versionTime,
                  color: isSelected ? C.amber : C.sub,
                  fontWeight: isSelected ? 600 : 400,
                }}>
                  {ver.isCurrent ? '● ปัจจุบัน' : new Date(ver.timestamp).toLocaleString('th-TH')}
                </span>
                {!ver.isCurrent && (
                  <button
                    style={styles.restoreBtn}
                    onClick={(e) => { e.stopPropagation(); onRestore?.(ver.original); }}
                  >
                    ↩ กู้คืน
                  </button>
                )}
              </div>
            );
          })}
          {history.length === 0 && (
            <p style={styles.empty}>ยังไม่มีประวัติการแก้ไข</p>
          )}
        </div>

        {/* Diff content view */}
        <div style={styles.diffContent}>
          {prevVersion && (
            <div style={styles.diffLabel}>
              เปรียบเทียบกับ: {new Date(prevVersion.timestamp).toLocaleString('th-TH')}
            </div>
          )}
          <div style={styles.diffBody}>
            {diffSegments.map((seg, i) => {
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
                // ถ้าเป็น current version → ข้อความใหม่ = ดำปกติไม่มี highlight
                // ถ้าเป็น version เก่า → ข้อความใหม่ของ version นั้น = ดำปกติไม่มี highlight
                return (
                  <span key={i} style={selectedIdx === -1 ? undefined : undefined}>
                    {seg.text}
                  </span>
                );
              }
              return null;
            })}
          </div>
        </div>
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
    padding: '8px 12px',
    borderBottom: `1px solid ${C.border}`,
    maxHeight: 200,
    overflowY: 'auto',
  },
  versionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px',
    cursor: 'pointer',
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  versionTime: {
    flex: 1,
    fontSize: 12,
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
    fontStyle: 'italic',
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
};
