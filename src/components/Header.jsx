import { useState, useRef, useMemo } from 'react';
import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { parseQuery, matchQuery } from '../utils/searchQuery';
import { useFontSize } from '../utils/useFontSize';
import { useLocale } from '../utils/useLocale';

const SORT_OPTIONS = [
  { key: 'updated', label: 'แก้ไขล่าสุด' },
  { key: 'created', label: 'วันที่สร้าง' },
  { key: 'alpha', label: 'ตัวอักษร' },
  { key: 'hasImage', label: 'มีรูปภาพ' },
];

export default function Header({ onSidebar, onSearch, onSettings, onSelectNote, onSelectTodo }) {
  const { state, dispatch } = useApp();
  const { t, locale } = useLocale();
  const d = (useFontSize() - 1) * 2;
  const [searchText, setSearchText] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const holdTimer = useRef(null);

  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    const pq = parseQuery(searchText);
    const results = [];

    // Notes — ทุก state
    state.notes.forEach((n) => {
      if (!matchQuery(n.title, pq) && !matchQuery(n.content, pq)) return;
      let tag, tagColor, tagBg;
      if (n.deletedAt) { tag = t('notecard.tagNoteDeleted'); tagColor = '#fff'; tagBg = '#dc2626'; }
      else if (n.archived) { tag = t('notecard.tagNoteArchive'); tagColor = C.sub; tagBg = '#e7e5e4'; }
      else { tag = t('notecard.tagNote'); tagColor = '#fff'; tagBg = C.amber; }
      results.push({ type: 'note', item: n, tag, tagColor, tagBg, order: n.deletedAt ? 2 : n.archived ? 1 : 0 });
    });

    // Todos — ทุก state
    state.todos.forEach((td) => {
      if (!matchQuery(td.title, pq) && !matchQuery(td.note, pq)) return;
      let tag, tagColor, tagBg;
      if (td.deletedAt) { tag = t('notecard.tagTodoDeleted'); tagColor = '#fff'; tagBg = '#dc2626'; }
      else { tag = t('notecard.tagTodo'); tagColor = '#fff'; tagBg = '#1e3a5f'; }
      results.push({ type: 'todo', item: td, tag, tagColor, tagBg, order: td.deletedAt ? 2 : 0 });
    });

    // เรียง: ปกติก่อน → archive → ลบ
    results.sort((a, b) => a.order - b.order);
    return results.slice(0, 12);
  }, [searchText, state.notes, state.todos, locale]);

  const hasResults = searchResults.length > 0;

  const handleSearch = (e) => {
    setSearchText(e.target.value);
    onSearch?.(e.target.value);
    setShowResults(!!e.target.value.trim());
  };

  const handleClear = () => {
    setSearchText('');
    onSearch?.('');
    setShowResults(false);
  };

  const handleSelectNote = (note) => {
    setShowResults(false);
    onSelectNote?.(note);
  };

  const handleSelectTodo = (todo) => {
    setShowResults(false);
    onSelectTodo?.(todo);
  };

  const toggleView = () => {
    const isNote = state.activeTab === 'note';
    if (isNote) {
      dispatch({ type: 'SET_NOTE_VIEW_MODE', payload: state.noteViewMode === 'grid' ? 'list' : 'grid' });
    } else {
      dispatch({ type: 'SET_TODO_VIEW_MODE', payload: state.todoViewMode === 'grid' ? 'list' : 'grid' });
    }
  };
  const currentViewMode = state.activeTab === 'note' ? state.noteViewMode : state.todoViewMode;

  const handleSortDown = () => {
    holdTimer.current = setTimeout(() => {
      setShowSortMenu(true);
      holdTimer.current = null;
    }, 500);
  };

  const handleSortUp = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      dispatch({ type: 'SET_SORT', payload: { sortDir: state.sortDir === 'desc' ? 'asc' : 'desc' } });
    }
  };

  const selectSort = (key) => {
    dispatch({ type: 'SET_SORT', payload: { sortBy: key } });
    setShowSortMenu(false);
  };

  return (
    <header style={styles.header} className="pt-safe-header">
      <button style={{ ...styles.avatar, width: 34 + d, height: 34 + d }} onClick={onSettings}>
        {state.profileImage
          ? <img src={state.profileImage} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : <span style={{ ...styles.avatarText, fontSize: 15 + d }}>N</span>
        }
      </button>

      <div style={styles.center}>
        <div style={{ ...styles.searchWrap, position: 'relative' }}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder={t('header.search')}
            value={searchText}
            onChange={handleSearch}
            onFocus={() => searchText.trim() && setShowResults(true)}
            style={{ ...styles.searchInput, fontSize: 14 + d }}
          />
          {searchText && (
            <button style={styles.clearBtn} onClick={handleClear}>✕</button>
          )}

          {/* Search results dropdown */}
          {showResults && hasResults && (
            <>
              <div style={styles.backdrop} onClick={() => setShowResults(false)} />
              <div style={styles.resultsDropdown}>
                {searchResults.map((r) => (
                  <button
                    key={r.item.id}
                    style={styles.resultItem}
                    onClick={() => r.type === 'note' ? handleSelectNote(r.item) : handleSelectTodo(r.item)}
                  >
                    <span style={{ ...styles.stateTag, background: r.tagBg, color: r.tagColor }}>
                      {r.tag}
                    </span>
                    <span style={{
                      ...styles.resultTitle,
                      textDecoration: r.item.done ? 'line-through' : 'none',
                      opacity: (r.item.deletedAt || r.item.archived) ? 0.65 : 1,
                    }}>
                      {r.item.title || 'ไม่มีชื่อ'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button style={{ ...styles.iconBtn, width: 36 + d, height: 36 + d }} onClick={toggleView}>
          {currentViewMode === 'grid' ? (
            <svg width={20 + d} height={20 + d} viewBox="0 0 18 18" fill="none">
              <circle cx="3" cy="4" r="1.8" fill={C.sub}/>
              <rect x="7" y="2.8" width="9" height="2.4" rx="1.2" fill={C.sub}/>
              <circle cx="3" cy="9" r="1.8" fill={C.sub}/>
              <rect x="7" y="7.8" width="9" height="2.4" rx="1.2" fill={C.sub}/>
              <circle cx="3" cy="14" r="1.8" fill={C.sub}/>
              <rect x="7" y="12.8" width="9" height="2.4" rx="1.2" fill={C.sub}/>
            </svg>
          ) : (
            <span style={{ fontSize: 20 + d, color: C.sub }}>⊞</span>
          )}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.iconBtn, width: 36 + d, height: 36 + d }}
            onPointerDown={handleSortDown}
            onPointerUp={handleSortUp}
            onPointerLeave={() => { clearTimeout(holdTimer.current); holdTimer.current = null; }}
          >
            <span style={{ fontSize: 20 + d, color: C.sub }}>{state.sortDir === 'desc' ? '↓' : '↑'}</span>
          </button>

          {showSortMenu && (
            <>
              <div style={styles.backdrop} onClick={() => setShowSortMenu(false)} />
              <div style={styles.sortMenu}>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    style={{ ...styles.sortOption, background: state.sortBy === opt.key ? C.amberLight : 'transparent' }}
                    onClick={() => selectSort(opt.key)}
                  >
                    {opt.key === 'updated' ? t('header.sortUpdated') : opt.key === 'created' ? t('header.sortCreated') : opt.key === 'alpha' ? t('header.sortAlpha') : t('header.sortHasImage')}
                    {state.sortBy === opt.key && <span style={{ color: C.amber }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <button style={styles.hamburgerBtn} onClick={onSidebar}>
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <rect y="0" width="20" height="3" rx="1.5" fill={C.text}/>
          <rect y="6.5" width="20" height="3" rx="1.5" fill={C.text}/>
          <rect y="13" width="20" height="3" rx="1.5" fill={C.text}/>
        </svg>
      </button>
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 12,
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    margin: '0 6px',
    minWidth: 0,
    overflow: 'visible',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
  },
  hamburgerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  },
  searchWrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    background: C.white,
    borderRadius: 24,
    padding: '7px 14px',
    border: `1px solid ${C.border}`,
    gap: 8,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  searchIcon: { fontSize: 13, opacity: 0.45 },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    fontFamily: C.font,
    color: C.text,
    minWidth: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.muted,
    fontSize: 13,
    padding: 0,
    lineHeight: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: C.amber,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: C.white, fontSize: 15, fontWeight: 700 },
  backdrop: { position: 'fixed', inset: 0, zIndex: 99 },
  resultsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    zIndex: 100,
    maxHeight: 320,
    overflowY: 'auto',
  },
  resultSection: {
    padding: '8px 14px 4px',
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: C.font,
    textAlign: 'left',
    fontSize: 14,
    color: C.text,
    borderBottom: `1px solid ${C.border}`,
  },
  resultTitle: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  stateTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
    flexShrink: 0,
    marginRight: 8,
    whiteSpace: 'nowrap',
  },
  sortMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    zIndex: 100,
    minWidth: 160,
    overflow: 'hidden',
  },
  sortOption: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: C.font,
    color: C.text,
    textAlign: 'left',
  },
};
