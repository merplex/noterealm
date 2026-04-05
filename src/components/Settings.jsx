import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function Settings({ onClose }) {
  const { state, dispatch } = useApp();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />

        <div style={styles.header}>
          <h2 style={styles.title}>ตั้งค่า</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Default view */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>หน้าเริ่มต้น</div>
              <div style={styles.desc}>เข้าแอปแล้วจะเปิดหน้าไหนก่อน</div>
            </div>
            <div style={styles.segmented}>
              <button
                style={{ ...styles.seg, background: state.defaultTab === 'note' ? C.amber : C.white, color: state.defaultTab === 'note' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_DEFAULT_TAB', payload: 'note' })}
              >
                📝 Note
              </button>
              <button
                style={{ ...styles.seg, background: state.defaultTab === 'todo' ? C.amber : C.white, color: state.defaultTab === 'todo' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_DEFAULT_TAB', payload: 'todo' })}
              >
                ✅ Todo
              </button>
            </div>
          </div>

          <div style={styles.divider} />

          {/* View mode */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>รูปแบบการแสดงผล</div>
              <div style={styles.desc}>Grid (2 คอลัมน์) หรือ List</div>
            </div>
            <div style={styles.segmented}>
              <button
                style={{ ...styles.seg, background: state.viewMode === 'grid' ? C.amber : C.white, color: state.viewMode === 'grid' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' })}
              >
                ⊞ Grid
              </button>
              <button
                style={{ ...styles.seg, background: state.viewMode === 'list' ? C.amber : C.white, color: state.viewMode === 'list' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })}
              >
                ☰ List
              </button>
            </div>
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
    background: 'rgba(0,0,0,0.35)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
    background: C.bg,
    borderRadius: '20px 20px 0 0',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: C.border,
    margin: '12px auto 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px 10px',
  },
  title: { fontSize: 18, fontWeight: 700, color: C.text },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.muted },
  body: { padding: '4px 20px 24px' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0',
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 },
  desc: { fontSize: 12, color: C.muted },
  segmented: {
    display: 'flex',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  seg: {
    padding: '7px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: C.font,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  divider: { height: 1, background: C.border },
};
