import { useRef, useMemo } from 'react';
import { C } from '../../constants/theme';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';

const REF_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#16a34a"/><rect x="4.5" y="3" width="7" height="9" rx="1" fill="white"/><line x1="6" y1="5.5" x2="10" y2="5.5" stroke="#16a34a" stroke-width=".6"/><line x1="6" y1="7.2" x2="10" y2="7.2" stroke="#16a34a" stroke-width=".6"/><line x1="6" y1="8.9" x2="8.5" y2="8.9" stroke="#16a34a" stroke-width=".6"/></svg>')}`;

export default function NoteCard({ note, onClick, listMode, isSelecting, isSelected, onLongPress, onSelect, onTagClick }) {
  const { t } = useLocale();
  const fsLevel = useFontSize();
  const d = (fsLevel - 1) * 2;
  const longPressTimer = useRef(null);
  const pointerStart = useRef(null);
  const suppressClick = useRef(false);

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

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const handlePointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      onLongPress?.(note);
    }, 500);
  };

  const handlePointerMove = (e) => {
    if (!pointerStart.current) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx > 10 || dy > 10) cancelLongPress();
  };

  const handlePointerUp = () => {
    cancelLongPress();
    pointerStart.current = null;
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (isSelecting) {
      onSelect?.(note);
    } else {
      onClick?.(note);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: isSelecting ? 10 : 0, minWidth: 0, overflow: 'hidden' }}>
      {isSelecting && (
        <div
          style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${isSelected ? '#57534e' : C.border}`,
            background: isSelected ? '#57534e' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 14, color: '#fff', fontSize: 13, fontWeight: 700,
            transition: 'all 0.15s', cursor: 'pointer',
          }}
          onClick={handleClick}
        >
          {isSelected ? '✓' : ''}
        </div>
      )}

      <div
        style={{
          ...styles.card,
          flex: 1,
          opacity: isArchived || isDeleted ? 0.72 : 1,
          outline: isSelected ? '2px solid #57534e' : 'none',
          background: isSelected ? '#f5f5f4' : C.white,
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(note); }}
      >
        {isArchived && <span style={styles.archiveBadge}>{t('notecard.archived')}</span>}
        {isDeleted && <span style={styles.deletedBadge}>{t('notecard.deleted')}</span>}

        {note.pinned && !isDeleted && <span style={styles.pinBadge}>📌</span>}

        {note.title && <h3 style={{ ...styles.title, fontSize: 14 + d }}>{note.title}</h3>}

        {previewHtml && (
          <p style={{ ...styles.content, fontSize: 12 + d }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}

        {note.images?.filter(img => !img.startsWith('http')).length > 0 && (
          <div style={styles.imageRow}>
            {note.images.filter(img => !img.startsWith('http')).slice(0, 3).map((img, i) => (
              <div key={i} style={{ ...styles.thumb, backgroundImage: `url(${img})` }} />
            ))}
          </div>
        )}

        <div style={styles.footer}>
          {note.tags?.filter((t) => !t.startsWith('_')).map((tag) => (
            <span
              key={tag}
              style={styles.tag}
              onClick={(e) => { e.stopPropagation(); onTagClick?.(`tag:${tag}`); }}
            >
              {tag}
            </span>
          ))}
          {note.aiBlocks?.length > 0 && <span style={styles.aiBadge}>🤖</span>}
          {note.refs?.length > 0 && <img src={REF_ICON} width={14} height={14} style={{ verticalAlign: 'middle' }} />}
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
    overflow: 'hidden',
    minWidth: 0,
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
    wordBreak: 'break-all',
    overflowWrap: 'break-word',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
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
    wordBreak: 'break-all',
    overflowWrap: 'break-word',
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
