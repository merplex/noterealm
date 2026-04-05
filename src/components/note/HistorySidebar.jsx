import { useState, useMemo } from 'react';
import { C } from '../../constants/theme';
import { diffWords, stripHtml } from '../../utils/diff';

/**
 * Build cumulative annotated segments showing which version introduced each piece of text.
 * Returns array of { text, version, type: 'text'|'del' }
 * - version = number (1 = oldest, n = current)
 * - type 'text' = present in the target version
 * - type 'del' = was deleted at this version
 */
function buildCumulativeDiff(versions, upToIdx) {
  // versions: array of content strings, chronological (oldest first)
  // upToIdx: show up to this index (0-based, where last = current)
  if (versions.length === 0) return [];
  if (versions.length === 1) return [{ text: versions[0], version: 1, type: 'text' }];

  // Start from oldest
  let segments = [{ text: versions[0], version: 1, type: 'text' }];

  for (let i = 1; i <= upToIdx; i++) {
    const prevText = segments.filter(s => s.type === 'text').map(s => s.text).join('');
    const nextText = versions[i];
    const diff = diffWords(prevText, nextText);

    const newSegments = [];
    // Keep all previous 'del' segments
    for (const s of segments) {
      if (s.type === 'del') newSegments.push(s);
    }

    // Walk through diff and the old 'text' segments to assign versions
    let oldTextPos = 0;
    const oldTextSegments = segments.filter(s => s.type === 'text');
    let oldSegIdx = 0;
    let oldSegCharPos = 0;

    for (const d of diff) {
      if (d.type === 'same') {
        // This text existed before — find which version(s) it came from
        let remaining = d.text.length;
        while (remaining > 0 && oldSegIdx < oldTextSegments.length) {
          const seg = oldTextSegments[oldSegIdx];
          const avail = seg.text.length - oldSegCharPos;
          const take = Math.min(remaining, avail);
          newSegments.push({ text: seg.text.slice(oldSegCharPos, oldSegCharPos + take), version: seg.version, type: 'text' });
          oldSegCharPos += take;
          remaining -= take;
          oldTextPos += take;
          if (oldSegCharPos >= seg.text.length) {
            oldSegIdx++;
            oldSegCharPos = 0;
          }
        }
      } else if (d.type === 'del') {
        // Text was deleted at version i+1
        let remaining = d.text.length;
        while (remaining > 0 && oldSegIdx < oldTextSegments.length) {
          const seg = oldTextSegments[oldSegIdx];
          const avail = seg.text.length - oldSegCharPos;
          const take = Math.min(remaining, avail);
          newSegments.push({ text: seg.text.slice(oldSegCharPos, oldSegCharPos + take), version: i + 1, type: 'del' });
          oldSegCharPos += take;
          remaining -= take;
          oldTextPos += take;
          if (oldSegCharPos >= seg.text.length) {
            oldSegIdx++;
            oldSegCharPos = 0;
          }
        }
      } else if (d.type === 'add') {
        // New text added at version i+1
        newSegments.push({ text: d.text, version: i + 1, type: 'text' });
      }
    }

    segments = newSegments;
  }

  return segments;
}

export default function HistorySidebar({ note, onRestore, onClose }) {
  const history = note?.history || [];
  const currentContent = stripHtml(note?.content || '');
  const [selectedIdx, setSelectedIdx] = useState(-1); // -1 = current version

  // Chronological versions: oldest first → current last
  const chronoVersions = useMemo(() => {
    const vers = [];
    for (let i = history.length - 1; i >= 0; i--) {
      vers.push(stripHtml(history[i].content || ''));
    }
    vers.push(currentContent); // current = last
    return vers;
  }, [history, currentContent]);

  // Total number of versions
  const totalVersions = chronoVersions.length;

  // Map selectedIdx to chronological index
  // selectedIdx -1 = current = chronoVersions[totalVersions-1]
  // selectedIdx 1 = history[0] = chronoVersions[totalVersions-2]
  // selectedIdx N = history[N-1] = chronoVersions[totalVersions-1-N]
  const chronoIdx = selectedIdx === -1 ? totalVersions - 1 : totalVersions - 1 - selectedIdx;

  // Build cumulative diff up to selected version
  const segments = useMemo(() => {
    return buildCumulativeDiff(chronoVersions, chronoIdx);
  }, [chronoVersions, chronoIdx]);

  // The selected version's "own" version number
  const selectedVerNum = chronoIdx + 1;

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

          {/* History versions */}
          {history.map((ver, i) => {
            const idx = i + 1;
            const isSelected = selectedIdx === idx;
            const verNum = totalVersions - idx;
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
                  {new Date(ver.timestamp).toLocaleString('th-TH')}
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

        {/* Diff content view */}
        <div style={styles.diffContent}>
          <div style={styles.diffBody}>
            {segments.map((seg, i) => {
              const isOwnVersion = seg.version === selectedVerNum;
              const verLabel = seg.version < totalVersions ? `ver${seg.version}` : 'ปัจจุบัน';

              if (seg.type === 'del') {
                // Deleted text: red strikethrough + red bubble
                return (
                  <span key={i} style={styles.diffDelWrap}>
                    <span style={styles.verBubbleDel}>{verLabel}</span>
                    <span style={styles.diffDel}>{seg.text}</span>
                  </span>
                );
              }

              if (isOwnVersion) {
                // Selected version's own text: plain black, no highlight
                return <span key={i}>{seg.text}</span>;
              }

              // Older version's text: gray highlight + bubble
              return (
                <span key={i} style={styles.diffOldWrap}>
                  <span style={styles.verBubble}>{verLabel}</span>
                  <span style={styles.diffOld}>{seg.text}</span>
                </span>
              );
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
  diffBody: {
    fontSize: 14,
    lineHeight: 2.2,
    fontFamily: C.font,
    color: C.text,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  diffOldWrap: {
    position: 'relative',
    display: 'inline',
  },
  diffOld: {
    background: '#e8e4dd',
    borderRadius: 2,
    padding: '1px 2px',
  },
  verBubble: {
    position: 'relative',
    top: -8,
    fontSize: 8,
    color: C.sub,
    background: '#e8e4dd',
    borderRadius: 3,
    padding: '0 3px',
    marginRight: 1,
    verticalAlign: 'super',
    lineHeight: 1,
  },
  diffDelWrap: {
    position: 'relative',
    display: 'inline',
  },
  diffDel: {
    color: '#dc2626',
    textDecoration: 'line-through',
    background: '#fef2f2',
    borderRadius: 2,
    padding: '1px 2px',
  },
  verBubbleDel: {
    position: 'relative',
    top: -8,
    fontSize: 8,
    color: '#dc2626',
    background: '#fef2f2',
    borderRadius: 3,
    padding: '0 3px',
    marginRight: 1,
    verticalAlign: 'super',
    lineHeight: 1,
  },
};
