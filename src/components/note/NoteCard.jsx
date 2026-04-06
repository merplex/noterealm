import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export default function NoteCard({ note, onClick, listMode }) {
  const { actions } = useApp();

  // Memoize preview — strip base64 ก่อน regex เพื่อกัน JS block บน LINE notes
  const previewHtml = useMemo(() => {
    if (!note.content) return '';
    return note.content
      .replace(/data:[a-z/+]+;base64,[A-Za-z0-9+/=]*/g, '')
      .slice(0, 2000)
      .replace(/<img[^>]*>/g, '🖼')
      .replace(/\[.*?\]/g, '')
      .slice(0, 200);
  }, [note.content]);
  const isArchived = note.archived;
  const isDeleted = !!note.deletedAt;
  const [swipeX, setSwipeX] = useState(0);
  const swipeXRef = useRef(0);
  const swipingRef = useRef(false);
  const touchStart = useRef(null);
  const cardRef = useRef(null);

  const DELETE_THRESHOLD = 90;
  const gestureRef = useRef(null); // null=undecided, 'h'=horizontal, 'v'=vertical

  const reset = useCallback(() => {
    swipeXRef.current = 0;
    swipingRef.current = false;
    gestureRef.current = null;
    setSwipeX(0);
    touchStart.current = null;
  }, []);

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipingRef.current = false;
    swipeXRef.current = 0;
    gestureRef.current = null;
    setSwipeX(0);
  };

  // non-passive listener — lock gesture direction ตั้งแต่ 4px แรก
  // เพื่อให้ preventDefault() ยิงก่อน browser commit vertical scroll
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onTouchMove = (e) => {
      if (!touchStart.current) return;
      const dx = e.touches[0].clientX - touchStart.current.x;
      const dy = e.touches[0].clientY - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Lock gesture direction ที่ 4px แรก ก่อน browser commit scroll
      if (gestureRef.current === null && (absDx > 4 || absDy > 4)) {
        gestureRef.current = absDx >= absDy ? 'h' : 'v';
      }

      if (gestureRef.current === 'h') {
        e.preventDefault(); // ป้องกัน scroll (ต้อง non-passive)
        swipingRef.current = true;
        const clamped = Math.max(-100, Math.min(0, dx));
        swipeXRef.current = clamped;
        setSwipeX(clamped);
      }
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const handleTouchEnd = () => {
    if (swipeXRef.current <= -DELETE_THRESHOLD) {
      if (isDeleted) actions.restoreNote(note.id);
      else actions.deleteNote(note.id);
    }
    reset();
  };

  // Fallback: ถ้า touchEnd ไม่ fire → auto-reset หลัง 3s
  // timer restart ทุกครั้งที่ swipeX เปลี่ยน (touchMove) จึงไม่ reset ระหว่าง swipe
  useEffect(() => {
    if (swipeX >= 0) return;
    const timer = setTimeout(reset, 3000);
    return () => clearTimeout(timer);
  }, [swipeX, reset]);

  const handleClick = () => {
    if (swipingRef.current || Math.abs(swipeXRef.current) > 5) return;
    onClick?.(note);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {/* Delete background — แสดงเฉพาะตอน swipe */}
      {swipeX < 0 && (
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
      )}

      <div
        ref={cardRef}
        style={{
          ...styles.card,
          opacity: isArchived || isDeleted ? 0.72 : 1,
          transform: swipeX < 0 ? `translateX(${swipeX}px)` : undefined,
          transition: swipingRef.current ? 'none' : 'transform 0.2s',
          willChange: swipeX < 0 ? 'transform' : undefined,
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={reset}
      >
        {isArchived && <span style={styles.archiveBadge}>📦 ARCHIVED</span>}
        {isDeleted && <span style={styles.deletedBadge}>🗑 ถูกลบ</span>}

        {note.pinned && !isDeleted && <span style={styles.pinBadge}>📌</span>}

        {note.title && <h3 style={styles.title}>{note.title}</h3>}

        {previewHtml && (
          <p
            style={styles.content}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
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
    touchAction: 'pan-y', // browser จัดการแค่ scroll แนวตั้ง — แนวนอนปล่อยให้ JS (swipe-to-delete)
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
