import { useState, useRef } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export default function NoteCard({ note, onClick, listMode }) {
  const { actions } = useApp();
  const isArchived = note.archived;
  const isDeleted = !!note.deletedAt;
  const [swipeX, setSwipeX] = useState(0);
  const swipeXRef = useRef(0); // ref สำหรับอ่านค่า swipe ใน handleTouchEnd (ไม่ stale)
  const swipingRef = useRef(false);
  const touchStart = useRef(null);

  const DELETE_THRESHOLD = 90;

  const reset = () => {
    swipeXRef.current = 0;
    swipingRef.current = false;
    setSwipeX(0);
    touchStart.current = null;
  };

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipingRef.current = false;
    swipeXRef.current = 0;
    setSwipeX(0); // reset ถ้า card ค้างอยู่จากครั้งก่อน
  };

  const handleTouchMove = (e) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      swipingRef.current = true;
      const clamped = Math.max(-100, Math.min(0, dx));
      swipeXRef.current = clamped;
      setSwipeX(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (swipeXRef.current <= -DELETE_THRESHOLD) {
      if (isDeleted) {
        actions.restoreNote(note.id);
      } else {
        actions.deleteNote(note.id);
      }
    }
    reset();
  };

  const handleClick = () => {
    if (swipingRef.current || Math.abs(swipeXRef.current) > 5) return;
    onClick?.(note);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {/* Delete background */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 100,
        background: isDeleted ? '#16a34a' : '#dc2626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        borderRadius: '0 12px 12px 0',
      }}>
        {isDeleted ? 'คืนค่า' : 'ลบ'}
      </div>

      <div
        style={{
          ...styles.card,
          opacity: isArchived || isDeleted ? 0.72 : 1,
          transform: `translateX(${swipeX}px)`,
          transition: swipingRef.current ? 'none' : 'transform 0.2s',
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={reset}
      >
        {isArchived && <span style={styles.archiveBadge}>📦 ARCHIVED</span>}
        {isDeleted && <span style={styles.deletedBadge}>🗑 ถูกลบ</span>}

        {note.pinned && !isDeleted && <span style={styles.pinBadge}>📌</span>}

        {note.title && <h3 style={styles.title}>{note.title}</h3>}

        {note.content && (
          <p
            style={styles.content}
            dangerouslySetInnerHTML={{
              __html: note.content.replace(/<img[^>]*>/g, '🖼').replace(/\[.*?\]/g, '').slice(0, 200),
            }}
          />
        )}

        {note.images?.length > 0 && (
          <div style={styles.imageRow}>
            {note.images.slice(0, 3).map((img, i) => (
              <div key={i} style={{ ...styles.thumb, backgroundImage: `url(${img})` }} />
            ))}
          </div>
        )}

        <div style={styles.footer}>
          {note.tags?.filter((t) => !t.startsWith('_')).map((tag) => (
            <span key={tag} style={styles.tag}>
              {tag}
            </span>
          ))}
          {note.aiBlocks?.length > 0 && <span style={styles.aiBadge}>🤖</span>}
          {note.refs?.length > 0 && <span style={styles.refBadge}>🔗</span>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: C.white,
    borderRadius: 12,
    padding: 14,
    border: `1px solid ${C.border}`,
    cursor: 'pointer',
    position: 'relative',
  },
  archiveBadge: {
    display: 'inline-block',
    fontSize: 10,
    background: '#f5f5f4',
    color: C.sub,
    padding: '2px 6px',
    borderRadius: 4,
    marginBottom: 6,
  },
  deletedBadge: {
    display: 'inline-block',
    fontSize: 10,
    background: '#fef2f2',
    color: '#dc2626',
    padding: '2px 6px',
    borderRadius: 4,
    marginBottom: 6,
  },
  pinBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  content: {
    fontSize: 12,
    color: C.sub,
    lineHeight: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
  },
  imageRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 8,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    background: C.border,
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  tag: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    background: C.amberLight,
    color: C.amberDark,
  },
  aiBadge: { fontSize: 12 },
  refBadge: { fontSize: 12 },
};
