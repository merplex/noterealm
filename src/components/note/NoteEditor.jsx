import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { C } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import RelatePanel from './RelatePanel';
import FormatMenu from './FormatMenu';
import ReferModal from './ReferModal';
import HistorySidebar from './HistorySidebar';
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
  const [historyNote, setHistoryNote] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [selectionMenu, setSelectionMenu] = useState(null);
  const textareaRef = useRef(null);

  const isNew = !note?.id;
  const initializedRef = useRef(false);

  // Set initial content in contentEditable div
  useEffect(() => {
    if (textareaRef.current && !initializedRef.current) {
      initializedRef.current = true;
      textareaRef.current.innerHTML = note?.content || '';
    }
  }, [note?.content]);

  const insertAtCursor = useCallback((text) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('insertText', false, text);
  }, []);

  const syncContent = useCallback(() => {
    const el = textareaRef.current;
    if (el) setContent(el.innerHTML);
  }, []);

  const handleFormat = (action, value) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const cmdMap = {
      bold: 'bold',
      italic: 'italic',
      strike: 'strikeThrough',
      code: null,
      color: 'foreColor',
    };
    const cmd = cmdMap[action];
    if (cmd) {
      document.execCommand(cmd, false, action === 'color' ? value : null);
    } else if (action === 'code') {
      // Wrap selection in <code>
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const code = document.createElement('code');
        code.style.cssText = 'background:#f5f5f4;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px';
        range.surroundContents(code);
      }
    }
    syncContent();
  };

  const getSelectedText = useCallback(() => {
    const sel = window.getSelection();
    return sel ? sel.toString().trim() : '';
  }, []);

  const handleAddAI = useCallback(() => {
    const selected = getSelectedText();
    const id = uuidv4();
    const newBlock = {
      id,
      provider: state.aiSettings?.provider || 'claude',
      messages: [],
      wrappedContent: selected || null,
      autoAnalyze: !!selected,
    };
    setAiBlocks((prev) => [...prev, newBlock]);
  }, [state.aiSettings, getSelectedText]);

  const handleAddAccordion = useCallback(() => {
    const selected = getSelectedText();
    const id = uuidv4();
    const newBlock = {
      id,
      type: 'accordion',
      title: '',
      content: selected || '',
      open: true,
      autoTitle: !!selected,
    };
    setAiBlocks((prev) => [...prev, newBlock]);
    // ลบข้อความที่เลือกออก
    if (selected) {
      document.execCommand('delete');
      syncContent();
    }
  }, [getSelectedText, syncContent]);

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

  // Show floating toolbar when text is selected
  const handleSelectionCheck = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionMenu({
          top: rect.top - 44,
          left: rect.left + rect.width / 2,
        });
      } else {
        setSelectionMenu(null);
      }
    }, 200);
  }, []);


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
          <button style={styles.toolBtn} onClick={handleAddAccordion}>≡▼</button>
          <FormatMenu onFormat={handleFormat} />
          {!isNew && (
            <button
              style={{ ...styles.toolBtn, marginLeft: 'auto', fontSize: 11, color: C.sub }}
              onClick={() => setHistoryNote(note)}
            >
              history
            </button>
          )}
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

          <div
            ref={textareaRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="เขียนโน้ต..."
            onInput={(e) => { setContent(e.currentTarget.innerHTML); setSelectionMenu(null); }}
            onSelect={handleSelectionCheck}
            onBlur={() => setTimeout(() => setSelectionMenu(null), 300)}
            style={styles.textarea}
          />

          {/* Floating selection toolbar */}
          {selectionMenu && (
            <div style={{ ...styles.selectionToolbar, top: selectionMenu.top, left: selectionMenu.left }}>
              <button style={styles.selToolBtn} onPointerDown={(e) => { e.preventDefault(); handleAddAI(); setSelectionMenu(null); }}>✦ AI</button>
              <button style={styles.selToolBtn} onPointerDown={(e) => { e.preventDefault(); handleAddAccordion(); setSelectionMenu(null); }}>≡▼</button>
              <button style={styles.selToolBtn} onPointerDown={(e) => { e.preventDefault(); handleFormat('bold'); setSelectionMenu(null); }}>B</button>
              <button style={styles.selToolBtn} onPointerDown={(e) => { e.preventDefault(); handleFormat('italic'); setSelectionMenu(null); }}>I</button>
              <button style={styles.selToolBtn} onPointerDown={(e) => { e.preventDefault(); handleFormat('strike'); setSelectionMenu(null); }}>S</button>
            </div>
          )}

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

        {historyNote && (
          <HistorySidebar
            note={historyNote}
            onRestore={(version) => {
              if (version) {
                setContent(version.content);
              }
              setHistoryNote(null);
            }}
            onClose={() => setHistoryNote(null)}
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
    minHeight: 200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
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
  selectionToolbar: {
    position: 'fixed',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 2,
    background: '#1c1917',
    borderRadius: 8,
    padding: '4px 6px',
    zIndex: 200,
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  },
  selToolBtn: {
    padding: '6px 10px',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 4,
    fontFamily: C.font,
  },
};
