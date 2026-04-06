import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import NoteCard from './NoteCard';
import DynamicFilters from './DynamicFilters';

export default function NoteGrid({ searchText, activeFilter, onFilter, onEdit, onHistory }) {
  const { state } = useApp();

  const filteredNotes = useMemo(() => {
    let notes = [...state.notes];

    // Sidebar filter
    if (activeFilter === 'deleted') {
      notes = notes.filter((n) => n.deletedAt);
      notes.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
      return notes;
    }
    // Exclude deleted notes from all other views
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

    // Search
    if (searchText) {
      const q = searchText.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
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
        default: // updated
          return dir * (new Date(a.updatedAt) - new Date(b.updatedAt));
      }
    });

    return notes;
  }, [state.notes, state.sortBy, state.sortDir, activeFilter, searchText]);

  const isList = state.noteViewMode === 'list';

  return (
    <div>
      <DynamicFilters activeFilter={activeFilter} onFilter={onFilter} />
      <div className={isList ? '' : 'masonry-grid'} style={isList ? styles.list : undefined}>
        {filteredNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={onEdit}
            onHistory={onHistory}
            listMode={isList}
          />
        ))}
        {filteredNotes.length === 0 && (
          <div style={{ ...styles.empty, gridColumn: isList ? undefined : '1/-1' }}>
            {searchText ? 'ไม่พบโน้ตที่ค้นหา' : 'ยังไม่มีโน้ต — กด + เพื่อสร้าง'}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', padding: '8px 12px', gap: 8 },
  empty: { padding: 40, textAlign: 'center', color: '#a8a29e' },
};
