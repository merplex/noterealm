import { useState, useRef, useEffect } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { callAI } from '../../utils/callAI';

export default function AccordionBlock({ block, onUpdate, onDismiss }) {
  const { state } = useApp();
  const [open, setOpen] = useState(block.open ?? true);
  const [titleLoading, setTitleLoading] = useState(false);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const autoTitleDone = useRef(false);

  // Auto-generate title from content using AI (once on mount)
  useEffect(() => {
    if (!block.autoTitle || autoTitleDone.current || !block.content) return;
    autoTitleDone.current = true;

    const providerId = state.aiSettings?.provider || 'claude';
    setTitleLoading(true);

    callAI({
      provider: providerId,
      messages: [{ role: 'user', content: `สร้างหัวข้อสั้นๆ ไม่เกิน 8 คำ จากเนื้อหานี้ (ตอบแค่หัวข้อ ไม่ต้องมีคำอธิบาย):\n\n${block.content}` }],
      settings: state.aiSettings,
    })
      .then((title) => {
        onUpdate({ ...block, title: title.trim().replace(/^["']|["']$/g, ''), autoTitle: false });
      })
      .catch(() => {
        // Silently fail — user can type title manually
      })
      .finally(() => setTitleLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleChange = (e) => {
    onUpdate({ ...block, title: e.target.value });
  };

  const handleContentChange = (e) => {
    onUpdate({ ...block, content: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    onUpdate({ ...block, open: next });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {/* Toggle +/- */}
        <button style={styles.toggleBtn} onClick={toggleOpen}>
          {open ? '−' : '+'}
        </button>

        {/* Title input — always editable inline */}
        <input
          ref={titleRef}
          style={styles.titleInput}
          value={block.title || ''}
          onChange={handleTitleChange}
          placeholder={titleLoading ? 'AI กำลังตั้งชื่อ...' : 'หัวข้อ...'}
          disabled={titleLoading}
        />

        {/* Spacer so ✕ doesn't crowd empty title */}
        <span style={{ minWidth: 120, flex: 1 }} />

        {/* Delete button after title */}
        <button
          style={styles.dismissBtn}
          onClick={() => onDismiss?.(block)}
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
            rows={block.content ? undefined : 2}
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
    gap: 6,
    padding: '8px 10px',
    background: C.amberLight + '55',
  },
  toggleBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: `1.5px solid ${C.amber}`,
    background: 'transparent',
    cursor: 'pointer',
    color: C.amber,
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 1,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInput: {
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
    minWidth: 80,
    width: 'auto',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.muted,
    fontSize: 13,
    flexShrink: 0,
    padding: '0 4px',
    lineHeight: 1,
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
