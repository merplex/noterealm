import { C } from '../../constants/theme';

export default function DynamicFilters({ activeFilter, onFilter }) {
  const filters = [
    { key: 'all', label: 'All', icon: '' },
    { key: 'pinned', label: 'Pin', icon: '📌' },
    { key: 'line', label: 'Line', icon: '💬' },
    { key: 'email', label: 'Email', icon: '📧' },
    { key: 'picture', label: 'Picture', icon: '🖼' },
  ];

  return (
    <div style={styles.wrap}>
      {filters.map((f) => {
        const active = activeFilter === f.key;
        return (
          <button
            key={f.key}
            style={{
              ...styles.chip,
              background: active ? C.amber : C.white,
              color: active ? C.white : C.sub,
              borderColor: active ? C.amber : C.border,
            }}
            onClick={() => onFilter(f.key)}
          >
            {f.icon && <span>{f.icon}</span>}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    gap: 6,
    padding: '8px 14px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    borderRadius: 20,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: C.font,
    transition: 'all 0.15s',
    flexShrink: 0,
  },
};
