import { useState, useMemo } from 'react';
import { C } from '../../constants/theme';
import { diffWords, stripHtml } from '../../utils/diff';

export default function HistorySidebar({ note, onRestore, onClose }) {
  const history = note?.history || [];
  const currentContent = stripHtml(note?.content || '');
  const [selectedIdx, setSelectedIdx] = useState(-1); // -1 = current

  // Total versions: history (newest first) + current
  // Chronological order: history[last]=ver1, ..., history[0]=ver(n-1), current=ver(n)
  const totalVers = history.length + 1;

  // Get content & labels for selected version and its predecessor
  const { selContent, prevContent, selLabel, prevLabel } = useMemo(() => {
    if (selectedIdx === -1) {
      // Current selected
      return {
        selContent: currentContent,
        prevContent: history.length > 0 ? stripHtml(history[0].content || '') : null,
        selLabel: 'ปัจจุบัน',
        prevLabel: history.length > 0
          ? `ver${totalVers - 1}`
          : null,
      };
    }
    // History version selected (selectedIdx is 1-based into history array, but we use i+1 mapping)
    // selectedIdx maps to history[selectedIdx - 1] (0-based)
    const histIdx = selectedIdx - 1;
    const content = stripHtml(history[histIdx]?.content || '');
    const prevHistIdx = histIdx + 1;
    const prev = prevHistIdx < history.length ? stripHtml(history[prevHistIdx]?.content || '') : null;
    const verNum = totalVers - selectedIdx;
    const prevVerNum = prev !== null ? verNum - 1 : null;
    return {
      selContent: content,
      prevContent: prev,
      selLabel: `ver${verNum}`,
      prevLabel: prevVerNum !== null ? `ver${prevVerNum}` : null,
    };
  }, [selectedIdx, currentContent, history, totalVers]);

  // Compute diff segments
  const segments = useMemo(() => {
    if (prevContent === null) {
      // No previous version — all text is own
      return [{ type: 'same', text: selContent }];
    }
    return diffWords(prevContent, selContent);
  }, [selContent, prevContent]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sidebar} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📋 ประวัติการแก้ไข</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Version list */}
        <div style={styles.versionList}>
          {/* Current */}
          <div
            style={{
              ...styles.versionItem,
              background: selectedIdx === -1 ? C.amberLight : 'transparent',
              borderRadius: 6,
            }}
            onClick={() => setSelectedIdx(-1)}
          >
            <span style={{
              ...styles.versionDot,
              background: selectedIdx === -1 ? C.amber : C.border,
            }} />
            <span style={{
              ...styles.versionTime,
              color: selectedIdx === -1 ? C.amber : C.sub,
              fontWeight: selectedIdx === -1 ? 600 : 400,
            }}>
              ปัจจุบัน
            </span>
          </div>

          {/* History */}
          {history.map((ver, i) => {
            const idx = i + 1;
            const isSelected = selectedIdx === idx;
            const verNum = totalVers - idx;
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
                  ver{verNum} — {new Date(ver.timestamp).toLocaleString('th-TH')}
                </span>
                <button
                  style={styles.restoreBtn}
                  onClick={(e) => { e.stopPropagation(); onRestore?.(ver); }}
                >
                  ↩ กู้คืน
                </button>
              </div>
            );
          })}
          {history.length === 0 && (
            <p style={styles.empty}>ยังไม่มีประวัติการแก้ไข</p>
          )}
        </div>

        {/* Diff view */}
        <div style={styles.diffContent}>
          {prevLabel && (
            <div style={styles.diffLabel}>
              เปรียบเทียบ {selLabel} กับ {prevLabel}
            </div>
          )}
          <div style={styles.diffBody}>
            {segments.map((seg, i) => {
              // Render text with [box] and [img] placeholders as bubbles
              const renderText = (text) => {
                const parts = text.split(/(\[box\]|\[img\])/g);
                return parts.map((part, j) => {
                  if (part === '[box]') return <span key={j} style={styles.boxBubble}>box</span>;
                  if (part === '[img]') return <span key={j} style={styles.imgBubble}>img</span>;
                  return part;
                });
              };

              if (seg.type === 'same') {
                return <span key={i}>{renderText(seg.text)}</span>;
              }
              if (seg.type === 'del') {
                return (
                  <span key={i} style={styles.delWrap}>
                    <sup style={styles.verBubbleDel}>{prevLabel}</sup>
                    <span style={styles.delText}>{renderText(seg.text)}</span>
                  </span>
                );
              }
              if (seg.type === 'add') {
                return (
                  <span key={i} style={styles.addWrap}>
                    <sup style={styles.verBubbleAdd}>{selLabel}</sup>
                    <span style={styles.addText}>{renderText(seg.text)}</span>
                  </span>
                );
              }
              if (seg.type === 'mod') {
                return (
                  <span key={i} style={styles.modWrap}>
                    <sup style={styles.verBubbleMod}>{prevLabel}→{selLabel}</sup>
                    <span style={styles.modText}>{renderText(seg.text)}</span>
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
    flexShrink: 0,
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
    marginBottom: 10,
    fontStyle: 'italic',
  },
  diffBody: {
    fontSize: 14,
    lineHeight: 2.4,
    fontFamily: C.font,
    color: C.text,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  delWrap: {
    display: 'inline',
  },
  delText: {
    color: '#dc2626',
    textDecoration: 'line-through',
    background: '#fef2f2',
    borderRadius: 2,
    padding: '1px 2px',
  },
  verBubbleDel: {
    fontSize: 8,
    color: '#dc2626',
    background: '#fef2f2',
    borderRadius: 3,
    padding: '0 3px',
    marginRight: 1,
    lineHeight: 1,
    fontWeight: 600,
  },
  addWrap: {
    display: 'inline',
  },
  addText: {
    background: '#f0fdf4',
    borderRadius: 2,
    padding: '1px 2px',
    color: '#16a34a',
    fontWeight: 500,
  },
  verBubbleAdd: {
    fontSize: 8,
    color: '#16a34a',
    background: '#f0fdf4',
    borderRadius: 3,
    padding: '0 3px',
    marginRight: 1,
    lineHeight: 1,
    fontWeight: 600,
  },
  modWrap: {
    display: 'inline',
  },
  modText: {
    background: '#f3e8ff',
    borderRadius: 2,
    padding: '1px 2px',
    color: '#7c3aed',
    fontWeight: 500,
  },
  verBubbleMod: {
    fontSize: 8,
    color: '#7c3aed',
    background: '#f3e8ff',
    borderRadius: 3,
    padding: '0 3px',
    marginRight: 1,
    lineHeight: 1,
    fontWeight: 600,
  },
  boxBubble: {
    display: 'inline-block',
    fontSize: 10,
    color: '#92400e',
    background: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 600,
    verticalAlign: 'middle',
    lineHeight: 1.4,
  },
  imgBubble: {
    display: 'inline-block',
    fontSize: 10,
    color: '#1e40af',
    background: '#dbeafe',
    border: '1px solid #60a5fa',
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 600,
    verticalAlign: 'middle',
    lineHeight: 1.4,
  },
};
