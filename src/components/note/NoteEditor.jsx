import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import RelatePanel from './RelatePanel';
import FormatMenu from './FormatMenu';
import ReferModal from './ReferModal';
import AIBlock from './AIBlock';
import AccordionBlock from './AccordionBlock';

export default function NoteEditor({ note, onClose }) {
  const { state, actions } = useApp();
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState(note?.tags || []);
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [images, setImages] = useState(note?.images || []);
  const [aiBlocks, setAiBlocks] = useState(note?.aiBlocks || []);
  const [group, setGroup] = useState(note?.group || '');
  const [showRefer, setShowRefer] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const textareaRef = useRef(null);

  const isNew = !note?.id;

  const insertAtCursor = useCallback((text) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newContent = content.slice(0, start) + text + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  }, [content]);

  const wrapSelection = useCallback((before, after) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);
  }, [content]);

  const handleFormat = (action, value) => {
    const map = {
      bold: ['**', '**'],
      italic: ['*', '*'],
      strike: ['~~', '~~'],
      code: ['`', '`'],
      color: [`[c:${value}]`, '[/c]'],
    };
    const [before, after] = map[action] || ['', ''];
    wrapSelection(before, after);
  };

  const handleAddAI = useCallback(() => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const selected = content.slice(start, end).trim();

    const id = uuidv4();
    const newBlock = {
      id,
      provider: state.aiSettings?.provider || 'claude',
      messages: [],
      wrappedContent: selected || null,
      autoAnalyze: !!selected,
      insertPos: end,
    };
    setAiBlocks((prev) => [...prev, newBlock]);
    // ไม่ใส่ marker ใน content
  }, [content, state.aiSettings]);

  const handleAddAccordion = useCallback(() => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const selected = content.slice(start, end).trim();

    const id = uuidv4();
    const newBlock = {
      id,
      type: 'accordion',
      title: '',
      content: selected || '',
      open: true,
      autoTitle: !!selected,
      insertPos: start,
    };
    setAiBlocks((prev) => [...prev, newBlock]);
    // ลบข้อความที่เลือกออกจาก content (ย้ายไป accordion แล้ว)
    if (selected) {
      setContent(content.slice(0, start) + content.slice(end));
    }
  }, [content]);

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      const newImages = [];
      for (const file of files) {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        newImages.push(dataUrl);
      }
      setImages([...images, ...newImages]);
    };
    input.click();
  };

  const handleRefer = (refNote) => {
    insertAtCursor(`[[${refNote.id}:${refNote.title || 'Untitled'}]]`);
    setShowRefer(false);
  };

  const handleSave = async () => {
    const now = new Date().toISOString();
    // Clean any leftover AI_BLOCK markers from content
    const cleanContent = content.replace(/\n?\[AI_BLOCK:[^\]]+\]/g, '');
    const noteData = {
      id: note?.id || uuidv4(),
      title,
      content: cleanContent,
      tags,
      pinned,
      images,
      aiBlocks,
      group,
      archived: note?.archived || false,
      source: note?.source || 'manual',
      history: note?.history || [],
      refs: (content.match(/\[\[([^:]+):/g) || []).map((m) => m.slice(2, -1)),
      createdAt: note?.createdAt || now,
      updatedAt: now,
    };

    // Save history entry
    if (!isNew && note.content !== cleanContent) {
      noteData.history = [
        {
          timestamp: now,
          content: note.content,
          diff: {
            added: cleanContent.length - note.content.length > 0 ? cleanContent.length - note.content.length : 0,
            deleted: note.content.length - cleanContent.length > 0 ? note.content.length - cleanContent.length : 0,
            edited: 1,
          },
        },
        ...noteData.history,
      ];
    }

    try {
      if (isNew) {
        await actions.addNote(noteData);
      } else {
        await actions.updateNote(noteData);
      }
      onClose();
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    // Context menu handled natively in mobile; could add custom menu later
  };


  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Sticky: Related Notes */}
        <RelatePanel note={{ ...note, content }} onNavigate={() => {}} />

        {/* Sticky: Toolbar */}
        <div style={styles.toolbar}>
          <button style={styles.toolBtn} onClick={handleAddAI}>✦ AI</button>
          <button style={styles.toolBtn} onClick={handleImageUpload}>🖼️</button>
          <button style={styles.toolBtn} onClick={() => setShowRefer(true)}>🔗</button>
          <button style={styles.toolBtn} onClick={handleAddAccordion}>▶</button>
          <FormatMenu onFormat={handleFormat} />
        </div>

        {/* Scrollable body */}
        <div style={styles.body}>
          <input
            type="text"
            placeholder="หัวข้อ..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.titleInput}
          />

          <textarea
            ref={textareaRef}
            placeholder="เขียนโน้ต..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onContextMenu={handleContextMenu}
            style={styles.textarea}
            rows={8}
          />

          {/* Render AI Blocks & Accordion Blocks */}
          {aiBlocks.map((block) => {
            const updateBlock = (updated) =>
              setAiBlocks(aiBlocks.map((b) => (b.id === updated.id ? updated : b)));
            const dismissBlock = (b, action) => {
              const lastAiMsg = [...(b.messages || [])].reverse().find((m) => m.role === 'assistant');
              const aiText = lastAiMsg?.content || '';

              if (action === 'append' && aiText) {
                setContent((prev) => prev.trimEnd() + '\n\n' + aiText);
              } else if (action === 'replace' && aiText) {
                const pos = b.insertPos ?? content.length;
                setContent((prev) => prev.slice(0, pos) + '\n' + aiText + prev.slice(pos));
              }
              // 'close' หรือไม่มี action → ไม่แก้ content
              setAiBlocks(aiBlocks.filter((ab) => ab.id !== b.id));
            };

            if (block.type === 'accordion') {
              return (
                <AccordionBlock
                  key={block.id}
                  block={block}
                  onUpdate={updateBlock}
                  onDismiss={dismissBlock}
                />
              );
            }
            return (
              <AIBlock
                key={block.id}
                block={block}
                wrappedContent={block.wrappedContent || null}
                onUpdate={updateBlock}
                onDismiss={dismissBlock}
              />
            );
          })}

          {/* Images */}
          {images.length > 0 && (
            <div style={styles.imageGrid}>
              {images.map((img, i) => (
                <div key={i} style={styles.imageWrap}>
                  <img src={img} alt="" style={styles.image} />
                  <button
                    style={styles.imgRemove}
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky: Footer */}
        <div style={styles.footer}>
          <select
            style={styles.groupSelect}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">กลุ่ม...</option>
            {state.groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <div style={styles.tagsWrap}>
            {tags.map((tag) => (
              <span key={tag} style={styles.tag}>
                {tag}
                <button
                  style={styles.tagRemove}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              style={styles.tagInput}
              placeholder="+ แท็ก"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
          </div>

          <button
            style={{ ...styles.pinBtn, color: pinned ? C.amber : C.muted }}
            onClick={() => setPinned(!pinned)}
          >
            📌
          </button>
          <button style={styles.cancelBtn} onClick={onClose}>ยกเลิก</button>
          <button style={styles.saveBtn} onClick={handleSave}>บันทึก</button>
        </div>

        {showRefer && (
          <ReferModal
            onSelect={handleRefer}
            onClose={() => setShowRefer(false)}
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  modal: {
    background: C.bg,
    width: '100%',
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderBottom: `1px solid ${C.border}`,
    background: C.bg,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexWrap: 'wrap',
  },
  toolBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: C.font,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
  },
  titleInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 20,
    fontWeight: 600,
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
    marginBottom: 8,
  },
  textarea: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
    resize: 'vertical',
    minHeight: 200,
    lineHeight: 1.7,
  },
  imageGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  imageWrap: { position: 'relative' },
  image: {
    width: 100,
    height: 100,
    objectFit: 'cover',
    borderRadius: 8,
  },
  imgRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
    position: 'sticky',
    bottom: 0,
    flexWrap: 'wrap',
  },
  groupSelect: {
    padding: '5px 8px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    fontSize: 12,
    fontFamily: C.font,
    background: C.white,
  },
  tagsWrap: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    background: C.amberLight,
    color: C.amberDark,
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.amberDark,
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
  },
  tagInput: {
    border: 'none',
    outline: 'none',
    fontSize: 12,
    fontFamily: C.font,
    width: 60,
    background: 'transparent',
  },
  pinBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.sub,
  },
  saveBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
};
