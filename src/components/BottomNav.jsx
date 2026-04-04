import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';

const TABS = [
  { key: 'note', icon: '📝', label: 'Note' },
  { key: 'todo', icon: '✅', label: 'Todo' },
];

export default function BottomNav() {
  const { state, dispatch } = useApp();

  return (
    <nav style={styles.nav}>
      {TABS.map((tab) => {
        const active = state.activeTab === tab.key;
        return (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(active ? styles.tabActive : {}),
            }}
            onClick={() => dispatch({ type: 'SET_TAB', payload: tab.key })}
          >
            <span style={styles.icon}>{tab.icon}</span>
            <span
              style={{
                ...styles.label,
                color: active ? C.amber : C.muted,
                fontWeight: active ? 600 : 400,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
    position: 'sticky',
    bottom: 0,
    zIndex: 50,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    borderTop: `2px solid ${C.amber}`,
  },
  icon: { fontSize: 20 },
  label: { fontSize: 11 },
};
