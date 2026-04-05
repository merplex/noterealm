import { C } from '../../constants/theme';

export default function NoteCard({ note, onClick }) {
  const isArchived = note.archived;

  return (
    <div
      style={{
        ...styles.card,
        opacity: isArchived ? 0.72 : 1,
      }}
      onClick={() => onClick?.(note)}
    >
      {isArchived && <span style={styles.archiveBadge}>📦 ARCHIVED</span>}

      {note.pinned && <span style={styles.pinBadge}>📌</span>}

      {note.title && <h3 style={styles.title}>{note.title}</h3>}

      {note.content && (
        <p style={styles.content}>
          {note.content.replace(/\[.*?\]/g, '').slice(0, 120)}
        </p>
      )}

      {note.images?.length > 0 && (
        <div style={styles.imageRow}>
          {note.images.slice(0, 3).map((img, i) => (
            <div key={i} style={{ ...styles.thumb, backgroundImage: `url(${img})` }} />
          ))}
        </div>
      )}

      <div style={styles.footer}>
        {note.tags?.map((tag) => (
          <span key={tag} style={styles.tag}>
            {tag}
          </span>
        ))}
        {note.aiBlocks?.length > 0 && <span style={styles.aiBadge}>🤖</span>}
        {note.refs?.length > 0 && <span style={styles.refBadge}>🔗</span>}
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
    transition: 'box-shadow 0.2s',
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
