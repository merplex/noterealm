import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import NoteCard from './NoteCard';
import DynamicFilters from './DynamicFilters';

export default function NoteGrid({ searchText, onEdit, onHistory }) {
  const { state } = useApp();
  const [filter, setFilter] = useState('all');

  const filteredNotes = useMemo(() => {
    let notes = [...state.notes];

    // Filter
    if (filter === 'pinned') notes = notes.filter((n) => n.pinned);
    else if (filter === 'archived') notes = notes.filter((n) => n.archived);
    else if (filter !== 'all') notes = notes.filter((n) => n.source === filter);
    else notes = notes.filter((n) => !n.archived);

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

    // Sort: pinned first, then by updatedAt desc
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return notes;
  }, [state.notes, filter, searchText]);

  return (
    <div>
      <DynamicFilters activeFilter={filter} onFilter={setFilter} />
      <div className="masonry-grid">
        {filteredNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={onEdit}
            onHistory={onHistory}
          />
        ))}
        {filteredNotes.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#a8a29e', gridColumn: '1/-1' }}>
            {searchText ? 'ไม่พบโน้ตที่ค้นหา' : 'ยังไม่มีโน้ต — กด + เพื่อสร้าง'}
          </div>
        )}
      </div>
    </div>
  );
}
