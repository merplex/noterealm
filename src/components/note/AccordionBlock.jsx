import { useState, useRef, useEffect } from 'react';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { callAI } from '../../utils/callAI';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';

// Pastel color palette — light tones, one color per block
const PASTEL = [
  { bg: '#fef9c3', border: '#fde047' }, // yellow
  { bg: '#dbeafe', border: '#93c5fd' }, // blue
  { bg: '#dcfce7', border: '#86efac' }, // green
  { bg: '#fce7f3', border: '#f9a8d4' }, // pink
  { bg: '#ede9fe', border: '#c4b5fd' }, // purple
  { bg: '#ffedd5', border: '#fdba74' }, // peach
  { bg: '#cffafe', border: '#67e8f9' }, // cyan
  { bg: '#fae8ff', border: '#e879f9' }, // lavender
];

function getBlockPastel(id) {
  let h = 0;
  for (const c of (id || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PASTEL[h % PASTEL.length];
}

export default function AccordionBlock({ block, onUpdate, onDismiss }) {
  const { state } = useApp();
  const { t } = useLocale();
  const d = (useFontSize() - 1) * 2;
  const [open, setOpen] = useState(block.open ?? true);
  const [titleLoading, setTitleLoading] = useState(false);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const autoTitleDone = useRef(false);
  const pastel = getBlockPastel(block.id);

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
      .catch(() => {})
      .finally(() => setTitleLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleChange = (e) => onUpdate({ ...block, title: e.target.value });

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
    <div style={{ ...styles.container, background: pastel.bg, borderColor: pastel.border }}>
      <div style={{ ...styles.header, background: pastel.bg }}>
        <button style={{ ...styles.toggleBtn, fontSize: 16 + d }} onClick={toggleOpen}>
          {open ? '×' : '+'}
        </button>
        <input
          ref={titleRef}
          style={{ ...styles.titleInput, fontSize: 14 + d }}
          value={block.title || ''}
          onChange={handleTitleChange}
          placeholder={titleLoading ? t('accordion.aiTitle') : t('accordion.titlePlaceholder')}
          disabled={titleLoading}
        />
        <span style={{ minWidth: 80, flex: 1 }} />
        <button style={styles.dismissBtn} onClick={() => onDismiss?.(block)} title="ลบ">✕</button>
      </div>

      {open && (
        <div style={{ ...styles.body, background: pastel.bg }}>
          <textarea
            ref={contentRef}
            style={{ ...styles.contentArea, fontSize: 13 + d }}
            value={block.content || ''}
            onChange={handleContentChange}
            placeholder={t('accordion.contentPlaceholder')}
            rows={block.content ? undefined : 2}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: '1px solid',
    borderRadius: 2,
    margin: '8px 0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
  },
  toggleBtn: {
    width: 24,
    height: 24,
    borderRadius: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: C.text,
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
