import { useState, useRef } from 'react';
import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';

const SORT_OPTIONS = [
  { key: 'updated', label: 'แก้ไขล่าสุด' },
  { key: 'created', label: 'วันที่สร้าง' },
  { key: 'alpha', label: 'ตัวอักษร' },
  { key: 'hasImage', label: 'มีรูปภาพ' },
];

export default function Header({ onSidebar, onSearch, onSettings }) {
  const { state, dispatch } = useApp();
  const [searchText, setSearchText] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const holdTimer = useRef(null);

  const handleSearch = (e) => {
    setSearchText(e.target.value);
    onSearch?.(e.target.value);
  };

  const toggleView = () => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'grid' ? 'list' : 'grid' });
  };

  // Short press = toggle asc/desc, long press = show sort menu
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
    <header style={styles.header}>
      {/* Hamburger */}
      <button style={styles.iconBtn} onClick={onSidebar}>
        <span style={styles.hamburger}>☰</span>
      </button>

      {/* Search bar */}
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="ค้นหา NoteRealm..."
          value={searchText}
          onChange={handleSearch}
          style={styles.searchInput}
        />
        {searchText && (
          <button style={styles.clearBtn} onClick={() => { setSearchText(''); onSearch?.(''); }}>✕</button>
        )}
      </div>

      {/* View toggle */}
      <button style={styles.iconBtn} onClick={toggleView} title={state.viewMode === 'grid' ? 'สลับเป็น List' : 'สลับเป็น Grid'}>
        <span style={styles.iconText}>{state.viewMode === 'grid' ? '☰' : '⊞'}</span>
      </button>

      {/* Sort button */}
      <div style={{ position: 'relative' }}>
        <button
          style={styles.iconBtn}
          onPointerDown={handleSortDown}
          onPointerUp={handleSortUp}
          onPointerLeave={() => { clearTimeout(holdTimer.current); holdTimer.current = null; }}
          title="เรียงลำดับ (กดค้างเพื่อเลือก)"
        >
          <span style={styles.iconText}>{state.sortDir === 'desc' ? '↓' : '↑'}</span>
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
                  {opt.label}
                  {state.sortBy === opt.key && <span style={{ color: C.amber }}>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Profile / Settings */}
      <button style={styles.avatar} onClick={onSettings}>
        <span style={styles.avatarText}>N</span>
      </button>
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 50,
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
    flexShrink: 0,
  },
  hamburger: { fontSize: 18, color: C.sub },
  iconText: { fontSize: 16, color: C.sub },
  searchWrap: {
    flex: 1,
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
