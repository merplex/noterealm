import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function SplashScreen() {
  const { dispatch } = useApp();

  const handleSelect = (tab) => {
    dispatch({ type: 'SET_TAB', payload: tab });
  };

  const handleOutsideClick = (e) => {
    if (e.target === e.currentTarget) {
      dispatch({ type: 'HIDE_SPLASH' });
    }
  };

  return (
    <div style={styles.overlay} onClick={handleOutsideClick}>
      <div style={styles.container}>
        <h1 style={styles.title}>NoteRealm</h1>
        <p style={styles.subtitle}>จดบันทึก & จัดการงาน</p>
        <div style={styles.cards}>
          <button style={styles.card} onClick={() => handleSelect('note')}>
            <span style={styles.cardIcon}>📝</span>
            <span style={styles.cardLabel}>Note</span>
          </button>
          <button style={styles.card} onClick={() => handleSelect('todo')}>
            <span style={styles.cardIcon}>✅</span>
            <span style={styles.cardLabel}>Todo</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  container: {
    background: C.bg,
    borderRadius: 20,
    padding: '40px 32px',
    textAlign: 'center',
    maxWidth: 340,
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: C.amber,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: C.sub,
    marginBottom: 28,
  },
  cards: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    background: C.white,
    border: `2px solid ${C.border}`,
    borderRadius: 14,
    padding: '24px 16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: { fontSize: 32 },
  cardLabel: { fontSize: 15, fontWeight: 600, color: C.text },
};
