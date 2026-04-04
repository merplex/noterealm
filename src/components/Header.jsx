import { useState } from 'react';
import { C } from '../constants/theme';
import { PROVIDERS } from '../constants/providers';
import { useApp } from '../context/AppContext';

export default function Header({ onNewItem, onSearch }) {
  const { state } = useApp();
  const [searchText, setSearchText] = useState('');

  const activeProvider = state.aiSettings?.provider || 'claude';
  const provider = PROVIDERS[activeProvider];

  const handleSearch = (e) => {
    setSearchText(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <header style={styles.header}>
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="ค้นหา..."
          value={searchText}
          onChange={handleSearch}
          style={styles.searchInput}
        />
        <span
          style={{ ...styles.providerBadge, background: provider.color + '20', color: provider.color }}
          title={provider.label}
        >
          {provider.icon}
        </span>
      </div>
      <button style={styles.addBtn} onClick={onNewItem}>
        <span style={styles.addIcon}>+</span>
      </button>
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    background: C.white,
    borderRadius: 10,
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    gap: 8,
  },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    fontFamily: C.font,
    color: C.text,
  },
  providerBadge: {
    fontSize: 14,
    padding: '2px 6px',
    borderRadius: 6,
    fontWeight: 600,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: C.amber,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    color: C.white,
    fontSize: 22,
    fontWeight: 300,
    lineHeight: 1,
  },
};
