import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function Sidebar({ onClose, onFilterTag, onFilterGroup, activeFilter, onTodoTrash }) {
  const { state } = useApp();

  const allTags = [...new Set(state.notes.flatMap((n) => n.tags || []))];
  const groups = state.groups || [];
  const deletedTodoCount = state.todos.filter((t) => t.deletedAt).length;

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandText}>NoteRealm</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <nav style={styles.nav}>
          <button
            style={{ ...styles.navItem, background: !activeFilter ? C.amberLight : 'transparent' }}
            onClick={() => { onFilterTag(null); onClose(); }}
          >
            <span>📝</span>
            <span>โน้ตทั้งหมด</span>
          </button>
          <button
            style={{ ...styles.navItem }}
            onClick={() => { onFilterTag('pinned'); onClose(); }}
          >
            <span>📌</span>
            <span>ปักหมุด</span>
          </button>
          <button
            style={{ ...styles.navItem, background: activeFilter === 'archived' ? C.amberLight : 'transparent' }}
            onClick={() => { onFilterTag('archived'); onClose(); }}
          >
            <span>📦</span>
            <span>เก็บถาวร</span>
          </button>
          <button
            style={{ ...styles.navItem, background: activeFilter === 'deleted' ? C.amberLight : 'transparent' }}
            onClick={() => { onFilterTag('deleted'); onClose(); }}
          >
            <span>🗑</span>
            <span>ถังขยะ</span>
            <span style={styles.count}>{state.notes.filter((n) => n.deletedAt).length}</span>
          </button>
        </nav>

        {/* Todo section */}
        <section style={styles.section}>
          <div style={styles.sectionLabel}>Todo</div>
          <button style={styles.navItem} onClick={onTodoTrash}>
            <span>🗑</span>
            <span>ถังขยะ Todo</span>
            {deletedTodoCount > 0 && (
              <span style={styles.count}>{deletedTodoCount}</span>
            )}
          </button>
        </section>

        {allTags.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionLabel}>แท็ก</div>
            {allTags.map((tag) => (
              <button
                key={tag}
                style={{ ...styles.navItem, background: activeFilter === `tag:${tag}` ? C.amberLight : 'transparent' }}
                onClick={() => { onFilterTag(`tag:${tag}`); onClose(); }}
              >
                <span style={styles.tagDot}>🏷</span>
                <span>{tag}</span>
                <span style={styles.count}>{state.notes.filter((n) => n.tags?.includes(tag)).length}</span>
              </button>
            ))}
          </section>
        )}

        {groups.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionLabel}>กลุ่ม</div>
            {groups.map((g) => (
              <button
                key={g.id}
                style={{ ...styles.navItem, background: activeFilter === `group:${g.id}` ? C.amberLight : 'transparent' }}
                onClick={() => { onFilterGroup(`group:${g.id}`); onClose(); }}
              >
                <span style={{ ...styles.groupDot, background: g.color || C.amber }} />
                <span>{g.name}</span>
                <span style={styles.count}>{state.notes.filter((n) => n.group === g.id).length}</span>
              </button>
            ))}
          </section>
        )}
      </aside>
    </>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 200,
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 260,
    background: C.sidebar,
    zIndex: 201,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
    overflowY: 'auto',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 16px 12px',
    borderBottom: `1px solid ${C.border}`,
  },
  brandText: { fontSize: 18, fontWeight: 700, color: C.amber },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.muted },
  nav: { padding: '8px 8px 0' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: C.font,
    color: C.text,
    textAlign: 'left',
    marginBottom: 2,
  },
  section: { padding: '8px 8px 0' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    padding: '8px 12px 4px',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tagDot: { fontSize: 14 },
  groupDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  count: {
    marginLeft: 'auto',
    fontSize: 11,
    color: C.muted,
    background: C.border,
    padding: '1px 6px',
    borderRadius: 10,
  },
};
