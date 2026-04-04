import { C } from '../../constants/theme';

function getDominantColor(diff) {
  if (!diff) return C.edit;
  const { added = 0, deleted = 0, edited = 0 } = diff;
  if (added >= deleted && added >= edited) return C.add;
  if (deleted >= added && deleted >= edited) return C.del;
  return C.edit;
}

export default function HistorySidebar({ note, onRestore, onClose }) {
  const history = note?.history || [];

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <h3 style={styles.title}>🕐 ประวัติ</h3>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.list}>
        {history.length === 0 && (
          <p style={styles.empty}>ยังไม่มีประวัติการแก้ไข</p>
        )}
        {history.map((ver, i) => {
          const dotColor = getDominantColor(ver.diff);
          return (
            <div key={i} style={styles.item}>
              <div style={styles.itemHeader}>
                <span style={{ ...styles.dot, background: dotColor }} />
                <span style={styles.timestamp}>
                  {new Date(ver.timestamp).toLocaleString('th-TH')}
                </span>
                <button
                  style={styles.restoreBtn}
                  onClick={() => onRestore?.(ver)}
                >
                  ↩ กู้คืน
                </button>
              </div>

              {ver.diff && (
                <div style={styles.diffBlock}>
                  {ver.diff.changes?.map((change, j) => (
                    <div
                      key={j}
                      style={{
                        ...styles.diffLine,
                        color:
                          change.type === 'add'
                            ? C.add
                            : change.type === 'del'
                            ? C.del
                            : C.edit,
                        background:
                          change.type === 'add'
                            ? '#dcfce7'
                            : change.type === 'del'
                            ? '#fef2f2'
                            : '#f5f3ff',
                      }}
                    >
                      {change.type === 'add' ? '+' : change.type === 'del' ? '-' : '~'}{' '}
                      {change.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 320,
    height: '100%',
    background: C.sidebar,
    borderLeft: `1px solid ${C.border}`,
    zIndex: 300,
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
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
  },
  empty: { color: C.muted, textAlign: 'center', padding: 20, fontSize: 13 },
  item: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `1px solid ${C.border}`,
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  timestamp: { flex: 1, fontSize: 12, color: C.sub },
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
  diffBlock: {
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  diffLine: {
    padding: '3px 8px',
    whiteSpace: 'pre-wrap',
  },
};
