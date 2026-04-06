import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import NoteCard from './NoteCard';
import DynamicFilters from './DynamicFilters';
import { C } from '../../constants/theme';

export default function NoteGrid({ searchText, activeFilter, onFilter, onEdit, onHistory }) {
  const { state, actions } = useApp();
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isSelecting = selectedIds.size > 0;

  // ล้าง selection เมื่อ filter เปลี่ยน
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeFilter]);

  const filteredNotes = useMemo(() => {
    let notes = [...state.notes];

    if (activeFilter === 'deleted') {
      notes = notes.filter((n) => n.deletedAt);
      notes.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
      return notes;
    }
    if (activeFilter === 'archive') {
      notes = notes.filter((n) => n.archived && !n.deletedAt);
      notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return notes;
    }

    // Exclude deleted & archived from all other views
    notes = notes.filter((n) => !n.deletedAt);

    if (activeFilter === 'pinned') {
      notes = notes.filter((n) => n.pinned);
    } else if (activeFilter === 'line') {
      notes = notes.filter((n) => n.source === 'line');
    } else if (activeFilter === 'email') {
      notes = notes.filter((n) => n.source === 'email');
    } else if (activeFilter === 'picture') {
      notes = notes.filter(
        (n) => n.images?.length > 0 || n.content?.includes('<img')
      );
    } else if (activeFilter?.startsWith('tag:')) {
      const tag = activeFilter.slice(4);
      notes = notes.filter((n) => n.tags?.includes(tag));
    } else if (activeFilter?.startsWith('group:')) {
      const groupId = activeFilter.slice(6);
      notes = notes.filter((n) => n.group === groupId);
    } else {
      notes = notes.filter((n) => !n.archived);
    }

    if (searchText) {
      const q = searchText.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    const dir = state.sortDir === 'asc' ? 1 : -1;
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      switch (state.sortBy) {
        case 'alpha':
          return dir * (a.title || '').localeCompare(b.title || '', 'th');
        case 'created':
          return dir * (new Date(a.createdAt) - new Date(b.createdAt));
        case 'hasImage':
          return dir * ((b.images?.length || 0) - (a.images?.length || 0));
        default:
          return dir * (new Date(a.updatedAt) - new Date(b.updatedAt));
      }
    });

    return notes;
  }, [state.notes, state.sortBy, state.sortDir, activeFilter, searchText]);

  const handleLongPress = (note) => {
    setSelectedIds(new Set([note.id]));
  };

  const handleSelect = (note) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(note.id)) next.delete(note.id);
      else next.add(note.id);
      return next;
    });
  };

  const cancelSelection = () => setSelectedIds(new Set());

  // Bulk actions
  const handleArchive = async () => {
    await Promise.all([...selectedIds].map((id) => actions.archiveNote(id)));
    cancelSelection();
  };
  const handleDelete = async () => {
    await Promise.all([...selectedIds].map((id) => actions.deleteNote(id)));
    cancelSelection();
  };
  const handleRestore = async () => {
    await Promise.all([...selectedIds].map((id) => actions.restoreNote(id)));
    cancelSelection();
  };
  const handlePermanentDelete = async () => {
    await Promise.all([...selectedIds].map((id) => actions.permanentDeleteNote(id)));
    cancelSelection();
  };
  const handleUnarchive = async () => {
    await Promise.all([...selectedIds].map((id) => actions.unarchiveNote(id)));
    cancelSelection();
  };

  // ปุ่มที่แสดงใน action bar ตาม filter
  const actionButtons = () => {
    if (activeFilter === 'deleted') {
      return (
        <>
          <button style={{ ...styles.actionBtn, background: '#dc2626' }} onClick={handlePermanentDelete}>
            🗑 ลบถาวร
          </button>
          <button style={{ ...styles.actionBtn, background: '#16a34a' }} onClick={handleRestore}>
            ↩ กู้คืน
          </button>
        </>
      );
    }
    if (activeFilter === 'archive') {
      return (
        <>
          <button style={{ ...styles.actionBtn, background: C.amber }} onClick={handleUnarchive}>
            ↩ กู้คืน
          </button>
          <button style={{ ...styles.actionBtn, background: '#dc2626' }} onClick={handleDelete}>
            🗑 ลบ
          </button>
        </>
      );
    }
    return (
      <>
        <button style={{ ...styles.actionBtn, background: '#78716c' }} onClick={handleArchive}>
          📦 Archive
        </button>
        <button style={{ ...styles.actionBtn, background: '#dc2626' }} onClick={handleDelete}>
          🗑 ลบ
        </button>
      </>
    );
  };

  const isList = state.noteViewMode === 'list';

  return (
    <div>
      <DynamicFilters activeFilter={activeFilter} onFilter={(f) => { cancelSelection(); onFilter(f); }} />
      <div className={isList ? '' : 'masonry-grid'} style={isList ? styles.list : undefined}>
        {filteredNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={onEdit}
            onHistory={onHistory}
            listMode={isList}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(note.id)}
            onLongPress={handleLongPress}
            onSelect={handleSelect}
          />
        ))}
        {filteredNotes.length === 0 && (
          <div style={{ ...styles.empty, columnSpan: isList ? undefined : 'all' }}>
            {searchText ? 'ไม่พบโน้ตที่ค้นหา' : 'ยังไม่มีโน้ต — กด + เพื่อสร้าง'}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {isSelecting && (
        <div style={styles.actionBar}>
          <div style={styles.actionBarTop}>
            <button style={styles.cancelBtn} onClick={cancelSelection}>✕ ยกเลิก</button>
            <span style={styles.selectionCount}>เลือก {selectedIds.size} รายการ</span>
          </div>
          <div style={styles.actionBtns}>
            {actionButtons()}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', padding: '8px 12px', gap: 8 },
  empty: { padding: 40, textAlign: 'center', color: '#a8a29e' },
  actionBar: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 480,
    background: C.white,
    borderTop: `1px solid ${C.border}`,
    padding: '12px 16px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    zIndex: 200,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.10)',
  },
  actionBarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    fontSize: 13,
    color: C.sub,
    cursor: 'pointer',
    padding: '4px 0',
    fontFamily: C.font,
  },
  actionBtns: {
    display: 'flex',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 12,
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
};
