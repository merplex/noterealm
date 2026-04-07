import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
import { stripHtml } from '../../utils/diff';

export default function NoteEditor({ note, onClose, onNavigateToNote }) {
  const { state, actions } = useApp();
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState(note?.tags || []);
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [images, setImages] = useState(note?.images || []);
  const [aiBlocks, setAiBlocks] = useState(note?.aiBlocks || []);
  const [group, setGroup] = useState(note?.group || '');
  const [showRefer, setShowRefer] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState(null);
  const bodyRef = useRef(null);
  const galleryRef = useRef(null);
  const [historyNote, setHistoryNote] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const textareaRef = useRef(null);
  const dirtyRef = useRef(false); // true เมื่อ user แก้ไขจริง — ป้องกัน auto-save ทับ webhook data
  const [selMenu, setSelMenu] = useState(null); // { x, y } for custom selection menu
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [previewNote, setPreviewNote] = useState(null); // popup preview ของ relate note
  const [lastSaved, setLastSaved] = useState(note?.updatedAt || null);
  const autoSaveTimer = useRef(null);

  const isNew = !note?.id;
  const initializedRef = useRef(false);

  // Extract inline images from content for gallery
  const inlineImages = useMemo(() => {
    if (!content) return [];
    const div = document.createElement('div');
    div.innerHTML = content;
    return Array.from(div.querySelectorAll('img')).map((img) => img.src).filter(Boolean);
  }, [content]);
  const allImages = [...inlineImages, ...images];
  const hasGallery = allImages.length > 0;

  // Track nearest image on scroll and center it in gallery
  useEffect(() => {
    const body = bodyRef.current;
    const gallery = galleryRef.current;
    if (!body || !gallery || !hasGallery) return;

    const handleScroll = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const imgs = textarea.querySelectorAll('img');
      if (imgs.length === 0) return;

      const bodyRect = body.getBoundingClientRect();
      const centerY = bodyRect.top + bodyRect.height / 2;
      let nearestIdx = 0;
      let minDist = Infinity;
      imgs.forEach((img, i) => {
        const rect = img.getBoundingClientRect();
        const dist = Math.abs(rect.top + rect.height / 2 - centerY);
        if (dist < minDist) { minDist = dist; nearestIdx = i; }
      });

      // Center the nearest gallery image and enlarge it
      const galleryScroll = gallery.firstChild;
      const galleryImgs = galleryScroll?.children;
      if (!galleryImgs) return;
      Array.from(galleryImgs).forEach((gImg, i) => {
        gImg.style.transform = i === nearestIdx ? 'scale(1.05)' : 'scale(1)';
      });
      if (galleryImgs[nearestIdx]) {
        const gImg = galleryImgs[nearestIdx];
        const scrollLeft = gImg.offsetLeft - galleryScroll.clientWidth / 2 + gImg.clientWidth / 2;
        galleryScroll.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    };

    body.addEventListener('scroll', handleScroll);
    // Initial call
    setTimeout(handleScroll, 200);
    return () => body.removeEventListener('scroll', handleScroll);
  }, [hasGallery, allImages.length]);

  // Set initial content in contentEditable div
  useEffect(() => {
    if (textareaRef.current && !initializedRef.current) {
      initializedRef.current = true;
      textareaRef.current.innerHTML = note?.content || '';
      // Auto-focus content area when creating new note
      if (isNew) {
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    }
  }, [note?.content, isNew]);

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
      underline: 'underline',
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

  const getSelectedContent = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { text: '', images: [] };
    const range = sel.getRangeAt(0);
    const fragment = range.cloneContents();
    const images = [];
    fragment.querySelectorAll('img').forEach((img) => {
      if (img.src) images.push(img.src);
    });
    const text = sel.toString().trim();
    return { text, images };
  }, []);

  const handleAddAI = useCallback(() => {
    const { text, images } = getSelectedContent();
    const id = uuidv4();
    const wrappedParts = [];
    if (text) wrappedParts.push(text);
    const newBlock = {
      id,
      provider: state.aiSettings?.provider || 'claude',
      messages: [],
      wrappedContent: wrappedParts.length > 0 ? wrappedParts.join('\n') : null,
      wrappedImages: images.length > 0 ? images : undefined,
    };
    // Blur active element to dismiss keyboard on mobile
    document.activeElement?.blur();
    setAiBlocks((prev) => [...prev, newBlock]);
  }, [state.aiSettings, getSelectedContent]);

  const handleAddAccordion = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const sel = window.getSelection();
    let selectedHtml = '';
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const fragment = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);
      selectedHtml = tempDiv.innerHTML;
    }
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
    contentArea.innerHTML = selectedHtml || '';

    // Toggle open/close
    toggleBtn.onclick = () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      toggleBtn.textContent = isOpen ? '+' : '−';
    };

    // Dismiss: restore content (including images) back to editor at accordion's position
    dismissBtn.onclick = () => {
      const html = contentArea.innerHTML || '';
      if (html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        while (tempDiv.firstChild) {
          wrapper.parentNode.insertBefore(tempDiv.firstChild, wrapper);
        }
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
    const selectedText = selectedHtml.replace(/<[^>]+>/g, '').trim();
    if (selectedText) {
      const providerId = state.aiSettings?.provider || 'claude';
      callAI({
        provider: providerId,
        messages: [{ role: 'user', content: `สร้างหัวข้อสั้นๆ ไม่เกิน 8 คำ จากเนื้อหานี้ (ตอบแค่หัวข้อ ไม่ต้องมีคำอธิบาย):\n\n${selectedText}` }],
        settings: state.aiSettings,
      }).then((title) => {
        titleInput.value = title.trim().replace(/^["']|["']$/g, '');
      }).catch(() => {});
    }
  }, [syncContent, state.aiSettings]);

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
        let dataUrl;
        try {
          const bitmap = await createImageBitmap(file);
          const MAX = 1200;
          let w = bitmap.width, h = bitmap.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();
          dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        } catch {
          dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
        }

        // Create inline image — text-height thumbnail, no delete button
        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'inline-note-img';
        img.style.cssText = 'height:1.2em;vertical-align:middle;border-radius:3px;margin:0 2px;cursor:default;';

        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          el.appendChild(img);
        }
      }
      syncContent();
    };
    fileInput.click();
  };

  // Auto-save (no new version, just save current state)
  const doAutoSave = useCallback(async () => {
    if (isNew) return; // Don't auto-save unsaved notes
    if (!dirtyRef.current) return; // ไม่ได้แก้ไข → ไม่ save ทับ (ป้องกันทับ webhook data)
    const el = textareaRef.current;
    const curContent = el ? el.innerHTML : content;
    const cleanContent = curContent.replace(/\n?\[AI_BLOCK:[^\]]+\]/g, '');
    const textOnly = cleanContent.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, '').trim();
    if (!title.trim() && !textOnly) return;

    const now = new Date().toISOString();
    try {
      await actions.updateNote({
        ...note,
        title: title.trim() || note.title,
        content: cleanContent,
        tags, pinned, images, aiBlocks, group,
        refs: (curContent.match(/\[\[([^:]+):/g) || []).map((m) => m.slice(2, -1)),
        updatedAt: now,
      });
      setLastSaved(now);
    } catch { /* silent */ }
  }, [isNew, note, title, content, tags, pinned, images, aiBlocks, group, actions]);

  // Debounced auto-save on content change
  useEffect(() => {
    if (isNew) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doAutoSave, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [content, title, doAutoSave, isNew]);

  const handleRefer = (refNote) => {
    insertAtCursor(`[[${refNote.id}:${refNote.title || 'Untitled'}]]`);
    setShowRefer(false);
  };

  const handleSave = async () => {
    const now = new Date().toISOString();
    // Clean any leftover AI_BLOCK markers from content
    const cleanContent = content.replace(/\n?\[AI_BLOCK:[^\]]+\]/g, '');
    // Don't save empty notes
    const textOnly = cleanContent.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, '').trim();
    if (!title.trim() && !textOnly) {
      onClose();
      return;
    }
    // Auto-generate title if empty
    let finalTitle = title.trim();
    if (!finalTitle && textOnly) {
      const readableText = cleanContent.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const lines = cleanContent
        .split(/<br\s*\/?>|<\/p>|<\/div>/i)
        .map(l => l.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim())
        .filter(Boolean);
      if (lines.length > 3) {
        // มีข้อมูลเกิน 3 บรรทัด → ใช้ AI คิดหัวข้อ
        try {
          const providerId = state.aiSettings?.provider || 'claude';
          const aiTitle = await callAI({
            provider: providerId,
            messages: [{ role: 'user', content: `สร้างหัวข้อสั้นๆ ไม่เกิน 8 คำ จากเนื้อหานี้ (ตอบแค่หัวข้อ ไม่ต้องมีคำอธิบาย):\n\n${readableText.slice(0, 300)}` }],
            settings: state.aiSettings,
          });
          finalTitle = aiTitle.trim().replace(/^["']|["']$/g, '').slice(0, 50);
        } catch (e) {
          console.warn('AI title generation failed:', e.message);
        }
        if (!finalTitle) finalTitle = (lines[0] || readableText).slice(0, 50);
      } else {
        // 1-3 บรรทัด → ใช้บรรทัดแรก ตัดที่ 20 คำ
        const firstLine = lines[0] || readableText;
        const words = firstLine.split(/\s+/).filter(Boolean);
        finalTitle = (words.length > 20 ? words.slice(0, 20).join(' ') : firstLine).slice(0, 50);
      }
    }

    const noteData = {
      id: note?.id || uuidv4(),
      title: finalTitle,
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
    // Clamp x so menu doesn't overflow left/right edges
    const menuWidth = 240; // approximate menu width
    const half = menuWidth / 2;
    const rawX = rect.left + rect.width / 2;
    const x = Math.max(half + 8, Math.min(rawX, window.innerWidth - half - 8));
    setSelMenu({ x, y: rect.top });
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
        <RelatePanel note={{ ...note, content }} onNavigate={(n) => setPreviewNote(n)} />

        {/* Sticky: Toolbar */}
        <div style={styles.toolbar}>
          <button style={styles.toolBtn} onClick={handleAddAI}>✦ AI</button>
          <div style={{ position: 'relative' }}>
            <button style={{ ...styles.toolBtn, fontSize: 18 }} onClick={() => setShowInsertMenu(!showInsertMenu)}>+</button>
            {showInsertMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowInsertMenu(false)} />
                <div style={styles.insertMenu}>
                  <button style={styles.insertOption} onClick={() => { setShowInsertMenu(false); handleImageUpload(); }}>🖼️ รูปภาพ</button>
                  <button style={styles.insertOption} onClick={() => { setShowInsertMenu(false); setShowRefer(true); }}>🔗 อ้างอิง</button>
                  <button style={styles.insertOption} onClick={() => { setShowInsertMenu(false); handleAddAccordion(); }}>≡ กล่องข้อความ</button>
                </div>
              </>
            )}
          </div>
          <FormatMenu onFormat={handleFormat} />
          <button
            style={{ ...styles.toolBtn, marginLeft: 'auto', color: pinned ? C.amber : C.muted }}
            onClick={() => setPinned(!pinned)}
          >
            📌
          </button>
          {!isNew && (
            <button
              style={styles.toolBtn}
              onClick={() => setHistoryNote(note)}
            >
              HISTORY
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div style={styles.body} ref={bodyRef}>
          <input
            type="text"
            placeholder="หัวข้อ..."
            value={title}
            onChange={(e) => { dirtyRef.current = true; setTitle(e.target.value); }}
            style={styles.titleInput}
          />

          <div
            ref={textareaRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="เขียนโน้ต..."
            onInput={(e) => { dirtyRef.current = true; setContent(e.currentTarget.innerHTML); }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              // If clicked on an inline image, highlight it in gallery
              if (e.target.tagName === 'IMG' && galleryRef.current) {
                const imgs = Array.from(textareaRef.current.querySelectorAll('img'));
                const idx = imgs.indexOf(e.target);
                if (idx >= 0) {
                  const galleryScroll = galleryRef.current.firstChild;
                  const galleryImgs = galleryScroll?.children;
                  if (galleryImgs) {
                    Array.from(galleryImgs).forEach((gImg, i) => {
                      gImg.style.transform = i === idx ? 'scale(1.05)' : 'scale(1)';
                    });
                    if (galleryImgs[idx]) {
                      const gImg = galleryImgs[idx];
                      const scrollLeft = gImg.offsetLeft - galleryScroll.clientWidth / 2 + gImg.clientWidth / 2;
                      galleryScroll.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                    }
                  }
                }
              }
            }}
            style={{ ...styles.textarea, WebkitUserSelect: 'text', WebkitTouchCallout: 'none' }}
          />

          {/* Render AI Blocks as popup overlay */}
          {aiBlocks.filter((b) => b.type !== 'accordion').length > 0 && (
            <div style={styles.aiOverlay} onTouchStart={() => document.activeElement?.blur()}>
              <div style={styles.aiPopup} onClick={(e) => e.stopPropagation()}>
                {aiBlocks.filter((b) => b.type !== 'accordion').map((block) => {
                  const updateBlock = (updated) =>
                    setAiBlocks(aiBlocks.map((b) => (b.id === updated.id ? updated : b)));
                  const dismissBlock = (b, action) => {
                    const lastAiMsg = [...(b.messages || [])].reverse().find((m) => m.role === 'assistant');
                    const aiText = lastAiMsg?.content || '';

                    if (action === 'append' && aiText) {
                      const el = textareaRef.current;
                      if (el) {
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
                  return (
                    <AIBlock
                      key={block.id}
                      block={block}
                      wrappedContent={block.wrappedContent || null}
                      wrappedImages={block.wrappedImages || null}
                      onUpdate={updateBlock}
                      onDismiss={dismissBlock}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Render Accordion Blocks inline */}
          {aiBlocks.filter((b) => b.type === 'accordion').map((block) => {
            const updateBlock = (updated) =>
              setAiBlocks(aiBlocks.map((b) => (b.id === updated.id ? updated : b)));
            const dismissBlock = (b) => {
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
            };
            return (
              <AccordionBlock
                key={block.id}
                block={block}
                onUpdate={updateBlock}
                onDismiss={dismissBlock}
              />
            );
          })}

        </div>

        {/* Image Gallery Bar */}
        {hasGallery && (
          <div style={styles.galleryBar} ref={galleryRef}>
            <div style={styles.galleryScroll}>
              {allImages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  style={styles.galleryImg}
                  onClick={() => {
                    if (fullscreenImg === src) {
                      // Closing fullscreen — move cursor behind this image
                      setFullscreenImg(null);
                      const textarea = textareaRef.current;
                      if (textarea) {
                        const imgs = textarea.querySelectorAll('img');
                        if (imgs[i]) {
                          const range = document.createRange();
                          const sel = window.getSelection();
                          range.setStartAfter(imgs[i]);
                          range.collapse(true);
                          sel.removeAllRanges();
                          sel.addRange(range);
                          const body = bodyRef.current;
                          if (body) {
                            const imgRect = imgs[i].getBoundingClientRect();
                            const bodyRect = body.getBoundingClientRect();
                            const scrollTop = body.scrollTop + (imgRect.top - bodyRect.top) - bodyRect.height / 2;
                            body.scrollTo({ top: scrollTop, behavior: 'smooth' });
                          }
                        }
                      }
                    } else {
                      // Opening fullscreen — blur to prevent keyboard
                      document.activeElement?.blur();
                      setFullscreenImg(src);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Fullscreen image overlay */}
        {fullscreenImg && (
          <div style={styles.fullscreenOverlay} onClick={() => setFullscreenImg(null)}>
            <img src={fullscreenImg} alt="" style={styles.fullscreenImg} />
          </div>
        )}

        {/* Sticky: Footer */}
        <div style={styles.footer}>
          {!isNew && lastSaved && (
            <span style={styles.saveInfo}>
              อัพเดท {new Date(lastSaved).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' })}
              {' จาก ver '}{(note?.history?.length || 0) + 1}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button style={styles.cancelBtn} onClick={() => { doAutoSave(); onClose(); }}>ออก</button>
          <button style={styles.saveBtn} onClick={handleSave}>บันทึก</button>
        </div>

        {showRefer && (
          <ReferModal
            noteId={note?.id}
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
                if (textareaRef.current) {
                  textareaRef.current.innerHTML = version.content;
                }
              }
              setHistoryNote(null);
            }}
            onClose={() => setHistoryNote(null)}
          />
        )}

        {/* Preview popup ของ relate note */}
        {previewNote && (
          <div style={styles.previewOverlay} onClick={() => setPreviewNote(null)}>
            <div style={styles.previewModal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.previewHeader}>
                <button
                  style={styles.previewEditBtn}
                  onClick={() => { doAutoSave(); onNavigateToNote?.(previewNote); }}
                >
                  แก้ไข
                </button>
                <div style={styles.previewTitle}>{previewNote.title || 'Untitled'}</div>
                <button style={styles.previewCloseBtn} onClick={() => setPreviewNote(null)}>✕</button>
              </div>
              <div
                style={styles.previewBody}
                dangerouslySetInnerHTML={{ __html: previewNote.content || '<p style="color:#a8a29e">ไม่มีเนื้อหา</p>' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  aiOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 150,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  aiPopup: {
    background: C.bg,
    borderRadius: 14,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
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
    gap: 4,
    padding: '8px 10px',
    borderBottom: `1px solid ${C.border}`,
    background: C.bg,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  toolBtn: {
    padding: '5px 8px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 'clamp(11px, 3.2vw, 15px)',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 1,
    minWidth: 0,
  },
  insertMenu: {
    position: 'absolute',
    top: 38,
    left: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 4,
    zIndex: 100,
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    minWidth: 160,
  },
  insertOption: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: C.font,
    textAlign: 'left',
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
    fontSize: 16,
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
    minHeight: 200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.7,
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
    flexWrap: 'nowrap',
    overflow: 'hidden',
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
    flexWrap: 'nowrap',
    gap: 4,
    alignItems: 'center',
    overflow: 'hidden',
    minWidth: 0,
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
  saveInfo: {
    fontSize: 11,
    color: C.muted,
    fontFamily: C.font,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.sub,
    flexShrink: 0,
  },
  saveBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 15,
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
  galleryBar: {
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
    height: '25vh',
    flexShrink: 0,
    overflow: 'hidden',
  },
  galleryScroll: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: '100%',
    overflowX: 'auto',
    padding: '8px 12px',
    scrollBehavior: 'smooth',
  },
  galleryImg: {
    height: 'calc(25vh - 24px)',
    width: 'auto',
    borderRadius: 8,
    cursor: 'pointer',
    flexShrink: 0,
    objectFit: 'contain',
    transition: 'transform 0.2s',
  },
  fullscreenOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  fullscreenImg: {
    maxWidth: '95vw',
    maxHeight: '95vh',
    objectFit: 'contain',
    borderRadius: 4,
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 200,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '7.5vh 16px',
  },
  previewModal: {
    background: C.bg,
    width: '100%',
    maxWidth: 580,
    height: '85vh',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${C.border}`,
    gap: 8,
  },
  previewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  },
  previewEditBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: `1px solid ${C.amber}`,
    background: C.white,
    color: C.amber,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: C.font,
    cursor: 'pointer',
    flexShrink: 0,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: C.white,
    color: C.muted,
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    fontSize: 15,
    lineHeight: 1.6,
    color: C.text,
    wordBreak: 'break-word',
  },
};
