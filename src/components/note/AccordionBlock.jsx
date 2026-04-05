import { useState, useRef, useEffect } from 'react';
import { C } from '../../constants/theme';

export default function AccordionBlock({ block, onUpdate, onDismiss }) {
  const [open, setOpen] = useState(block.open ?? true);
  const [editingTitle, setEditingTitle] = useState(!block.title || block.title === 'หัวข้อ');
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleChange = (e) => {
    onUpdate({ ...block, title: e.target.value });
  };

  const handleContentChange = (e) => {
    onUpdate({ ...block, content: e.target.value });
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingTitle(false);
      setOpen(true);
      onUpdate({ ...block, open: true });
      setTimeout(() => contentRef.current?.focus(), 50);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    onUpdate({ ...block, open: next });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.toggleBtn} onClick={toggleOpen}>
          <span style={styles.toggleIcon}>{open ? '−' : '+'}</span>
        </button>

        {editingTitle ? (
          <input
            ref={titleRef}
            style={styles.titleInput}
            value={block.title || ''}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={() => setEditingTitle(false)}
            placeholder="หัวข้อ..."
          />
        ) : (
          <span
            style={styles.title}
            onDoubleClick={() => setEditingTitle(true)}
          >
            {block.title || 'หัวข้อ'}
          </span>
        )}

        <button
          style={styles.dismissBtn}
          onClick={(e) => { e.stopPropagation(); onDismiss?.(block); }}
          title="ลบ"
        >
          ✕
        </button>
      </div>

      {open && (
        <div style={styles.body}>
          <textarea
            ref={contentRef}
            style={styles.contentArea}
            value={block.content || ''}
            onChange={handleContentChange}
            placeholder="เนื้อหา..."
            rows={2}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${C.amber}`,
    borderRadius: 8,
    margin: '8px 0',
    background: C.white,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    background: C.amberLight + '55',
  },
  toggleBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: `1px solid ${C.amber}`,
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: C.amber,
    fontWeight: 700,
    fontSize: 16,
  },
  toggleIcon: { lineHeight: 1 },
  titleInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    userSelect: 'none',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.muted,
    fontSize: 12,
    flexShrink: 0,
    padding: '0 2px',
  },
  body: {
    borderTop: `1px solid ${C.border}`,
    padding: '8px 12px',
  },
  contentArea: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 13,
    fontFamily: C.font,
    color: C.sub,
    background: 'transparent',
    resize: 'none',
    lineHeight: 1.6,
    minHeight: 40,
  },
};
