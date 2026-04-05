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
import { callAI } from '../../utils/callAI';

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
  const textareaRef = useRef(null);
  const [selMenu, setSelMenu] = useState(null); // { x, y } for custom selection menu

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
    const el = textareaRef.current;
    if (!el) return;

    const sel = window.getSelection();
    const selected = sel ? sel.toString().trim() : '';
    const id = uuidv4();

    // Create accordion element inline in contentEditable
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'false';
    wrapper.className = 'inline-accordion';
    wrapper.dataset.blockId = id;
    wrapper.style.cssText = `border:1px solid ${C.border};border-left:3px solid ${C.amber};border-radius:8px;margin:8px 0;background:${C.white};overflow:hidden;`;

    const header = document.createElement('div');
    header.style.cssText = `display:flex;align-items:center;gap:6px;padding:8px 10px;background:${C.amberLight}55;`;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '−';
    toggleBtn.style.cssText = `width:24px;height:24px;border-radius:6px;border:1.5px solid ${C.amber};background:transparent;cursor:pointer;color:${C.amber};font-weight:700;font-size:16px;line-height:1;flex-shrink:0;display:flex;align-items:center;justify-content:center;`;

    const titleInput = document.createElement('input');
    titleInput.placeholder = 'หัวข้อ...';
    titleInput.style.cssText = `border:none;outline:none;font-size:14px;font-weight:600;color:${C.text};background:transparent;flex:1;min-width:60px;`;

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '✕';
    dismissBtn.style.cssText = `background:none;border:none;cursor:pointer;color:${C.muted};font-size:13px;flex-shrink:0;padding:0 4px;`;

    const body = document.createElement('div');
    body.style.cssText = `border-top:1px solid ${C.border};padding:8px 12px;`;

    const contentArea = document.createElement('div');
    contentArea.contentEditable = 'true';
    contentArea.style.cssText = `font-size:13px;color:${C.sub};min-height:40px;outline:none;line-height:1.6;white-space:pre-wrap;`;
    contentArea.textContent = selected || '';

    // Toggle open/close
    toggleBtn.onclick = () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      toggleBtn.textContent = isOpen ? '+' : '−';
    };

    // Dismiss: restore content back to editor at accordion's position
    dismissBtn.onclick = () => {
      const text = contentArea.textContent || '';
      if (text) {
        const textNode = document.createTextNode(text);
        wrapper.parentNode.insertBefore(textNode, wrapper);
      }
      wrapper.remove();
      syncContent();
    };

    header.appendChild(toggleBtn);
    header.appendChild(titleInput);
    header.appendChild(dismissBtn);
    body.appendChild(contentArea);
    wrapper.appendChild(header);
    wrapper.appendChild(body);

    // Insert at cursor: delete selection first, then insert accordion
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);

      // Move cursor after the accordion
      range.setStartAfter(wrapper);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(wrapper);
    }

    syncContent();

    // Auto-generate title with AI if there's content
    if (selected) {
      const providerId = state.aiSettings?.provider || 'claude';
      callAI({
        provider: providerId,
        messages: [{ role: 'user', content: `สร้างหัวข้อสั้นๆ ไม่เกิน 8 คำ จากเนื้อหานี้ (ตอบแค่หัวข้อ ไม่ต้องมีคำอธิบาย):\n\n${selected}` }],
        settings: state.aiSettings,
      }).then((title) => {
        titleInput.value = title.trim().replace(/^["']|["']$/g, '');
      }).catch(() => {});
    }
  }, [syncContent, state.aiSettings]);

  const IMAGE_SIZES = ['10%', '25%', '100%'];

  const handleImageUpload = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = false;
    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      const el = textareaRef.current;
      if (!el) return;
      el.focus();

      for (const file of files) {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });

        // Create inline image wrapper
        const wrap = document.createElement('span');
        wrap.contentEditable = 'false';
        wrap.className = 'inline-img-wrap';
        wrap.style.cssText = 'display:inline;position:relative;margin:0 2px;vertical-align:middle;';
        wrap.dataset.size = '10%';

        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'width:10%;border-radius:4px;vertical-align:middle;cursor:pointer;';

        // Remove button — on the image, top-right corner, sized to fit
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.cssText = 'position:absolute;top:0;right:0;background:rgba(0,0,0,0.6);color:#fff;border:none;cursor:pointer;z-index:2;border-radius:50%;width:14px;height:14px;font-size:8px;line-height:1;display:flex;align-items:center;justify-content:center;';
        removeBtn.contentEditable = 'false';
        removeBtn.onclick = (ev) => {
          ev.stopPropagation();
          wrap.remove();
          syncContent();
        };

        // Size label — hidden at 5%
        const sizeLabel = document.createElement('span');
        sizeLabel.style.cssText = 'position:absolute;top:0;left:0;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;padding:1px 4px;font-size:9px;z-index:2;display:none;pointer-events:none;';

        // Click image to cycle size
        img.onclick = (ev) => {
          ev.stopPropagation();
          const curIdx = IMAGE_SIZES.indexOf(wrap.dataset.size);
          const nextIdx = (curIdx + 1) % IMAGE_SIZES.length;
          const nextSize = IMAGE_SIZES[nextIdx];
          wrap.dataset.size = nextSize;
          img.style.width = nextSize;

          // Adjust remove button size based on image size
          if (nextSize === '10%') {
            removeBtn.style.cssText = 'position:absolute;top:0;right:0;background:rgba(0,0,0,0.6);color:#fff;border:none;cursor:pointer;z-index:2;border-radius:50%;width:14px;height:14px;font-size:8px;line-height:1;display:flex;align-items:center;justify-content:center;';
            img.style.borderRadius = '4px';
            sizeLabel.style.display = 'none';
          } else {
            removeBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;border:none;cursor:pointer;z-index:2;border-radius:50%;width:22px;height:22px;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;';
            img.style.borderRadius = '8px';
            sizeLabel.style.display = 'block';
            sizeLabel.textContent = nextSize;
          }

          // Block display for larger sizes
          if (nextSize === '10%') {
            wrap.style.display = 'inline';
          } else {
            wrap.style.display = 'inline-block';
          }
          syncContent();
        };

        wrap.appendChild(removeBtn);
        wrap.appendChild(sizeLabel);
        wrap.appendChild(img);

        // Insert at cursor position — truly inline
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(wrap);
          range.setStartAfter(wrap);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          el.appendChild(wrap);
        }
      }
      syncContent();
    };
    fileInput.click();
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

  // Show custom selection menu when text is selected
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.toString().trim() || !sel.rangeCount) {
      setSelMenu(null);
      return;
    }
    // Check selection is inside our editor
    const el = textareaRef.current;
    if (!el || !el.contains(sel.anchorNode)) {
      setSelMenu(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelMenu({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  // Listen for selectionchange globally
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const handleCustomCut = useCallback(() => {
    document.execCommand('cut');
    setSelMenu(null);
    syncContent();
  }, [syncContent]);

  const handleCustomCopy = useCallback(() => {
    document.execCommand('copy');
    setSelMenu(null);
  }, []);

  const handleCustomPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand('insertText', false, text);
      syncContent();
    } catch {
      document.execCommand('paste');
      syncContent();
    }
    setSelMenu(null);
  }, [syncContent]);

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
            onInput={(e) => { setContent(e.currentTarget.innerHTML); }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ ...styles.textarea, WebkitUserSelect: 'text', WebkitTouchCallout: 'none' }}
          />

          {/* Render AI Blocks & Accordion Blocks */}
          {aiBlocks.map((block) => {
            const updateBlock = (updated) =>
              setAiBlocks(aiBlocks.map((b) => (b.id === updated.id ? updated : b)));
            const dismissBlock = (b, action) => {
              if (b.type === 'accordion') {
                // Accordion dismiss: คืนข้อความกลับเข้า content
                if (b.content) {
                  const el = textareaRef.current;
                  if (el) {
                    el.focus();
                    document.execCommand('insertText', false, b.content);
                    setContent(el.innerHTML);
                  } else {
                    setContent((prev) => prev + b.content);
                  }
                }
                setAiBlocks(aiBlocks.filter((ab) => ab.id !== b.id));
                return;
              }

              // AI block dismiss
              const lastAiMsg = [...(b.messages || [])].reverse().find((m) => m.role === 'assistant');
              const aiText = lastAiMsg?.content || '';

              if (action === 'append' && aiText) {
                const el = textareaRef.current;
                if (el) {
                  // Move cursor to end and insert
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(el);
                  range.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  document.execCommand('insertText', false, '\n\n' + aiText);
                  setContent(el.innerHTML);
                } else {
                  setContent((prev) => prev.trimEnd() + '\n\n' + aiText);
                }
              } else if (action === 'replace' && aiText) {
                const el = textareaRef.current;
                if (el) {
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(el);
                  range.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  document.execCommand('insertText', false, '\n' + aiText);
                  setContent(el.innerHTML);
                } else {
                  setContent((prev) => prev + '\n' + aiText);
                }
              }
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

          {/* Legacy images (non-inline) */}
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

        {/* Custom selection menu */}
        {selMenu && (
          <div style={{
            ...styles.selMenuBar,
            left: selMenu.x,
            top: selMenu.y,
          }}>
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleCustomCut(); }}>ตัด</button>
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleCustomCopy(); }}>คัดลอก</button>
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleCustomPaste(); }}>วาง</button>
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleAddAI(); setSelMenu(null); }}>✦ AI</button>
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleAddAccordion(); setSelMenu(null); }}>≡▼</button>
          </div>
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
  selMenuBar: {
    position: 'fixed',
    transform: 'translate(-50%, -110%)',
    display: 'flex',
    gap: 2,
    background: '#1f1f1f',
    borderRadius: 8,
    padding: '4px 2px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    zIndex: 200,
  },
  selMenuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: 12,
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: C.font,
    whiteSpace: 'nowrap',
    borderRadius: 6,
  },
};
