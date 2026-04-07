import { useState } from 'react';
import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function Sidebar({ onClose, onFilterTag, onFilterGroup, activeFilter, onTodoTrash }) {
  const { state, actions } = useApp();
  const [renamingTag, setRenamingTag] = useState(null); // tag string being renamed
  const [renameValue, setRenameValue] = useState('');

  // Derive tags from both notes and todos — ซ่อน internal tags (ขึ้นต้นด้วย _)
  const noteTags = state.notes.flatMap((n) => (n.tags || []).filter(t => !t.startsWith('_')));
  const todoTags = state.todos.flatMap((t) => (t.tags || []).filter(t => !t.startsWith('_')));
  const allTags = [...new Set([...noteTags, ...todoTags])].sort();

  const noteTagCount = (tag) => state.notes.filter((n) => (n.tags || []).includes(tag)).length;
  const todoTagCount = (tag) => state.todos.filter((t) => (t.tags || []).includes(tag)).length;

  const groups = state.groups || [];
  const deletedTodoCount = state.todos.filter((t) => t.deletedAt).length;

  const handleRenameSubmit = async (oldTag) => {
    if (renameValue.trim() && renameValue.trim() !== oldTag) {
      await actions.renameTag(oldTag, renameValue.trim());
    }
    setRenamingTag(null);
    setRenameValue('');
  };

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />

      {/* Rename popup — centered overlay */}
      {renamingTag && (
        <div style={styles.renameOverlay} onClick={() => { setRenamingTag(null); setRenameValue(''); }}>
          <div style={styles.renamePopup} onClick={(e) => e.stopPropagation()}>
            <div style={styles.renameTitle}>เปลี่ยนชื่อแท็ก</div>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(renamingTag);
                if (e.key === 'Escape') { setRenamingTag(null); setRenameValue(''); }
              }}
              style={styles.renameInput}
            />
            <div style={styles.renameFooter}>
              <button style={styles.renameCancelBtn} onClick={() => { setRenamingTag(null); setRenameValue(''); }}>ยกเลิก</button>
              <button style={styles.renameOkBtn} onClick={() => handleRenameSubmit(renamingTag)}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandText}>NoteRealm</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <nav style={styles.nav}>
          <div style={styles.sectionLabel}>Note</div>
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

        {/* Tags section */}
        {allTags.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionLabel}>แท็ก</div>
            {allTags.map((tag) => {
              const nCount = noteTagCount(tag);
              const tCount = todoTagCount(tag);
              const isActive = activeFilter === `tag:${tag}`;

              return (
                <div key={tag} style={{ ...styles.tagRow, background: isActive ? C.amberLight : 'transparent' }}>
                  <button
                    style={styles.tagMainBtn}
                    onClick={() => { onFilterTag(isActive ? null : `tag:${tag}`); onClose(); }}
                  >
                    <span style={styles.tagDot}>🏷</span>
                    <span style={styles.tagName}>{tag}</span>
                    <span style={styles.tagCounts}>
                      {nCount > 0 && <span style={styles.countBadge}>{nCount}N</span>}
                      {tCount > 0 && <span style={{ ...styles.countBadge, background: '#dbeafe', color: '#1e40af' }}>{tCount}T</span>}
                    </span>
                  </button>
                  <button
                    style={styles.iconBtn}
                    title="เปลี่ยนชื่อ"
                    onClick={() => { setRenamingTag(tag); setRenameValue(tag); }}
                  >
                    ✏️
                  </button>
                  <button
                    style={styles.iconBtn}
                    title="ลบแท็ก"
                    onClick={async () => {
                      if (confirm(`ลบแท็ก "${tag}" ออกจากทุก note/todo?`)) {
                        await actions.deleteTag(tag);
                        if (isActive) onFilterTag(null);
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
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
    paddingTop: 'calc(20px + var(--sat, env(safe-area-inset-top, 0px)))',
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
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
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
    padding: '10px 12px 4px',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Tag row — fixed-width icon columns, all centered
  tagRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 32px 32px',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  tagMainBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 6px 8px 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: C.font,
    color: C.text,
    textAlign: 'left',
    minWidth: 0,
    width: '100%',
  },
  tagDot: { fontSize: 14, flexShrink: 0 },
  tagName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tagCounts: { display: 'flex', gap: 3, flexShrink: 0 },
  countBadge: {
    fontSize: 10, fontWeight: 600,
    background: '#fef3c7', color: C.amber,
    padding: '1px 5px', borderRadius: 8,
  },
  iconBtn: {
    width: 32, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, padding: 0, flexShrink: 0, opacity: 0.7,
  },
  // Rename centered popup
  renameOverlay: {
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  renamePopup: {
    background: C.bg, borderRadius: 14, padding: 20,
    width: '100%', maxWidth: 340,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  renameTitle: {
    fontSize: 15, fontWeight: 600, color: C.text, fontFamily: C.font,
  },
  renameInput: {
    border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '8px 12px', fontSize: 14, outline: 'none',
    fontFamily: C.font, background: C.white,
    width: '100%',
  },
  renameFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  renameOkBtn: {
    background: C.amber, color: C.white, border: 'none',
    borderRadius: 8, padding: '7px 18px', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: C.font,
  },
  renameCancelBtn: {
    background: C.white, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
    fontSize: 13, color: C.sub, fontFamily: C.font,
  },
  tagDot2: { fontSize: 14 },
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
