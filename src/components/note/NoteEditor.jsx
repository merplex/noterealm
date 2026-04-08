import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
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
import CachedImage from '../CachedImage';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';

function AIOverlay({ children }) {
  const overlayRef = useRef(null);
  const [vvHeight, setVvHeight] = useState(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setVvHeight(vv.height);
      // scroll overlay so bottom is visible
      if (overlayRef.current) {
        overlayRef.current.scrollTop = overlayRef.current.scrollHeight;
      }
    };
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        ...styles.aiOverlay,
        ...(vvHeight ? { height: vvHeight, top: window.visualViewport?.offsetTop || 0, bottom: 'auto' } : {}),
      }}
    >
      {children}
    </div>
  );
}

function FullscreenViewer({ src, onClose }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const st = useRef({ scale: 1, tx: 0, ty: 0, pinching: false, startDist: 0, startScale: 1, dragging: false, startTouchX: 0, startTouchY: 0, startTx: 0, startTy: 0, moved: false });

  useEffect(() => {
    st.current.scale = 1; st.current.tx = 0; st.current.ty = 0;
    setScale(1); setTranslate({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onStart = (e) => {
      const s = st.current; s.moved = false;
      if (e.touches.length === 2) {
        s.pinching = true; s.dragging = false;
        s.startDist = dist(e.touches[0], e.touches[1]);
        s.startScale = s.scale;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        s.dragging = true;
        s.startTouchX = e.touches[0].clientX; s.startTouchY = e.touches[0].clientY;
        s.startTx = s.tx; s.startTy = s.ty;
      }
    };

    const onMove = (e) => {
      const s = st.current;
      if (s.pinching && e.touches.length === 2) {
        const d = dist(e.touches[0], e.touches[1]);
        s.scale = Math.min(6, Math.max(1, s.startScale * d / s.startDist));
        setScale(s.scale); s.moved = true; e.preventDefault();
      } else if (s.dragging && e.touches.length === 1 && s.scale > 1) {
        const dx = e.touches[0].clientX - s.startTouchX;
        const dy = e.touches[0].clientY - s.startTouchY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) s.moved = true;
        s.tx = s.startTx + dx; s.ty = s.startTy + dy;
        setTranslate({ x: s.tx, y: s.ty }); e.preventDefault();
      }
    };

    const onEnd = (e) => {
      const s = st.current;
      if (e.touches.length === 0) {
        if (s.scale < 1.1) {
          s.scale = 1; s.tx = 0; s.ty = 0;
          setScale(1); setTranslate({ x: 0, y: 0 });
        }
        if (!s.moved && s.scale <= 1.05) onClose();
        s.pinching = false; s.dragging = false;
      } else if (e.touches.length === 1 && s.pinching) {
        s.pinching = false; s.dragging = true;
        s.startTouchX = e.touches[0].clientX; s.startTouchY = e.touches[0].clientY;
        s.startTx = s.tx; s.startTy = s.ty;
      }
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [onClose]);

  return (
    <div ref={containerRef} style={styles.fullscreenOverlay}>
      <button
        style={{ position: 'absolute', top: 20, right: 20, zIndex: 1, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}
      >✕</button>
      <CachedImage
        src={src}
        style={{
          ...styles.fullscreenImg,
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: scale === 1 ? 'transform 0.2s' : 'none',
          cursor: scale > 1 ? 'grab' : 'default',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      />
    </div>
  );
}

export default function NoteEditor({ note, onClose, onNavigateToNote }) {
  const { state, actions } = useApp();
  const { t } = useLocale();
  const fsLevel = useFontSize();
  const d = (fsLevel - 1) * 2;
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState(note?.tags || []);
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [images, setImages] = useState(note?.images || []);
  const [aiBlocks, setAiBlocks] = useState(note?.aiBlocks || []);
  const [group, setGroup] = useState(note?.group || '');
  const [refs, setRefs] = useState(note?.refs || []);
  const [showRefer, setShowRefer] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState(null);
  const bodyRef = useRef(null);
  const galleryRef = useRef(null);
  const [historyNote, setHistoryNote] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dirtyRef = useRef(false); // true เมื่อ user แก้ไขจริง — ป้องกัน auto-save ทับ webhook data
  const aiTitleDoneRef = useRef(false); // AI auto-fill title ทำแล้วครั้งเดียว ไม่ทำซ้ำ
  const [selMenu, setSelMenu] = useState(null); // { x, y } for custom selection menu
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showUrlPopup, setShowUrlPopup] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const savedRangeRef = useRef(null);
  const urlPopupJustOpenedRef = useRef(false);
  const selMenuRef = useRef(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagPickerSearch, setTagPickerSearch] = useState('');
  const [previewNote, setPreviewNote] = useState(null); // popup preview ของ relate note
  const [lastSaved, setLastSaved] = useState(note?.updatedAt || null);
  const autoSaveTimer = useRef(null);

  const isNew = !note?.id;
  const initializedRef = useRef(false);

  // Landscape detection (mobile เท่านั้น — width < 1024)
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth > window.innerHeight && window.innerWidth < 1024
  );
  // อ่าน --sat / --sab จาก CSS var เพื่อใช้ใน inline style โดยตรง
  const [sat, setSat] = useState(0);
  const [sab, setSab] = useState(0);
  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth < 1024);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const satVal = parseInt(style.getPropertyValue('--sat')) || 0;
      const sabVal = parseInt(style.getPropertyValue('--sab')) || 0;
      setSat(satVal);
      setSab(sabVal);
    };
    read();
    // อ่านซ้ำหลัง 300ms เผื่อ NativeInsets inject ช้า
    const t = setTimeout(read, 300);
    return () => clearTimeout(t);
  }, []);

  // Extract inline images from content for gallery
  const inlineImages = useMemo(() => {
    if (!content) return [];
    const div = document.createElement('div');
    div.innerHTML = content;
    return Array.from(div.querySelectorAll('img')).map((img) => img.src).filter(Boolean);
  }, [content]);
  const allImages = [...inlineImages, ...images];
  const hasGallery = allImages.length > 0;

  const hasRelates = useMemo(() => {
    if (!note) return false;
    const myRefs = new Set(note.refs || []);
    return state.notes.some(n =>
      n.id !== note.id && !n.deletedAt &&
      (myRefs.has(n.id) || (n.refs || []).includes(note.id))
    );
  }, [note, state.notes]);

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
      const raw = note?.content || '';
      // ดึง [[id:title]] ที่อาจติดมาจากของเก่า → เพิ่มเข้า refs และลบออกจาก content
      const legacyRefs = [...raw.matchAll(/\[\[([^:]+):[^\]]*\]\]/g)].map(m => m[1]);
      if (legacyRefs.length > 0) {
        setRefs(prev => {
          const merged = [...new Set([...prev, ...legacyRefs])];
          return merged;
        });
      }
      textareaRef.current.innerHTML = raw.replace(/\[\[[^\]]*\]\]/g, '');
      if (isNew) setTimeout(() => textareaRef.current?.focus(), 100);
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
    // Clear selection + blur — ป้องกัน selectionchange re-trigger selMenu
    window.getSelection()?.removeAllRanges();
    document.activeElement?.blur();
    setSelMenu(null);
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
    titleInput.placeholder = t('accordion.titlePlaceholder');
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
      dirtyRef.current = true;
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
        refs,
        updatedAt: now,
      });
      setLastSaved(now);
    } catch { /* silent */ }
  }, [isNew, note, title, content, tags, pinned, images, aiBlocks, group, refs, actions]);

  // Debounced auto-save on content change
  useEffect(() => {
    if (isNew) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doAutoSave, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [content, title, refs, doAutoSave, isNew]);

  // AI auto-fill title: เกิน 3 บรรทัด + หัวข้อว่าง + ยังไม่เคย AI fill → คิดชื่อให้ครั้งเดียว
  const aiTitleTimer = useRef(null);
  useEffect(() => {
    if (aiTitleDoneRef.current) return;
    if (title.trim()) { aiTitleDoneRef.current = true; return; } // user ตั้งชื่อเองแล้ว
    clearTimeout(aiTitleTimer.current);
    aiTitleTimer.current = setTimeout(async () => {
      const cleanContent = content.replace(/\n?\[AI_BLOCK:[^\]]+\]/g, '');
      const lines = cleanContent
        .split(/<br\s*\/?>|<\/p>|<\/div>/i)
        .map(l => l.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim())
        .filter(Boolean);
      if (lines.length <= 3) return;
      if (title.trim()) return; // user อาจพิมพ์ชื่อระหว่างรอ
      try {
        const readableText = cleanContent.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
        const providerId = state.aiSettings?.provider || 'claude';
        const aiTitle = await callAI({
          provider: providerId,
          messages: [{ role: 'user', content: `สร้างหัวข้อสั้นๆ ไม่เกิน 8 คำ จากเนื้อหานี้ (ตอบแค่หัวข้อ ไม่ต้องมีคำอธิบาย):\n\n${readableText.slice(0, 300)}` }],
          settings: state.aiSettings,
        });
        const t = aiTitle.trim().replace(/^["']|["']$/g, '').slice(0, 50);
        if (t) { setTitle(t); aiTitleDoneRef.current = true; }
      } catch (e) {
        console.warn('AI auto-title failed:', e.message);
      }
    }, 1500);
    return () => clearTimeout(aiTitleTimer.current);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefer = (refNote) => {
    dirtyRef.current = true;
    setRefs((prev) => prev.includes(refNote.id) ? prev : [...prev, refNote.id]);
    setShowRefer(false);
  };

  const removeRef = (id) => setRefs((prev) => prev.filter((r) => r !== id));

  const handleSave = async () => {
    const now = new Date().toISOString();
    const cleanContent = content.replace(/\n?\[AI_BLOCK:[^\]]+\]/g, '');
    // Don't save empty notes
    const textOnly = cleanContent.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, '').trim();
    if (!title.trim() && !textOnly) {
      onClose();
      return;
    }
    // ถ้าหัวข้อยังว่าง → ใช้บรรทัดแรกของ content (AI ทำงานก่อนหน้าแล้วถ้าเกิน 3 บรรทัด)
    let finalTitle = title.trim();
    if (!finalTitle && textOnly) {
      const readableText = cleanContent.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const lines = cleanContent
        .split(/<br\s*\/?>|<\/p>|<\/div>/i)
        .map(l => l.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim())
        .filter(Boolean);
      const firstLine = lines[0] || readableText;
      const words = firstLine.split(/\s+/).filter(Boolean);
      finalTitle = (words.length > 20 ? words.slice(0, 20).join(' ') : firstLine).slice(0, 50);
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
      refs,
      createdAt: note?.createdAt || now,
      updatedAt: now,
    };

    // Save history entry
    const prevRefs = note?.refs || [];
    const refsAdded = refs.filter(id => !prevRefs.includes(id));
    const refsRemoved = prevRefs.filter(id => !refs.includes(id));
    const refsChanged = refsAdded.length > 0 || refsRemoved.length > 0;
    const contentChanged = !isNew && note.content !== cleanContent;

    if (!isNew && (contentChanged || refsChanged)) {
      const entry = {
        timestamp: now,
        content: note.content,
        diff: {
          added: contentChanged ? Math.max(0, cleanContent.length - note.content.length) : 0,
          deleted: contentChanged ? Math.max(0, note.content.length - cleanContent.length) : 0,
          edited: contentChanged ? 1 : 0,
        },
      };
      if (refsChanged) {
        entry.refsAdded = refsAdded.map(id => ({ id, title: state.notes.find(n => n.id === id)?.title || 'Untitled' }));
        entry.refsRemoved = refsRemoved.map(id => ({ id, title: state.notes.find(n => n.id === id)?.title || 'Untitled' }));
      }
      noteData.history = [entry, ...noteData.history];
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
      return;
    }

  };

  const handleAddTag = (val) => {
    const v = (val ?? tagInput).trim();
    if (v && !tags.includes(v)) {
      setTags(prev => [...prev, v]);
      dirtyRef.current = true;
    }
    setTagInput('');
  };

  const handleAddTagAction = () => {
    setShowInsertMenu(false);
    const selectedText = getSelectedText();
    if (selectedText.trim()) {
      handleAddTag(selectedText.trim());
    } else {
      setTagPickerSearch('');
      setShowTagPicker(true);
    }
  };

  // Show custom selection menu when text is selected
  // Clamp selMenu position หลัง render ด้วย width จริง (ไม่ต้องประมาณ)
  useLayoutEffect(() => {
    const el = selMenuRef.current;
    if (!el || !selMenu) return;
    const r = el.getBoundingClientRect();
    const overflow = r.right - (window.innerWidth - 8);
    if (overflow > 0) el.style.left = (parseFloat(el.style.left) - overflow) + 'px';
    const underflow = 8 - r.left;
    if (underflow > 0) el.style.left = (parseFloat(el.style.left) + underflow) + 'px';
  }, [selMenu]);

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
    // วาง center ไว้กลาง selection — useLayoutEffect จะ clamp หลัง render
    const x = rect.left + rect.width / 2;
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

  const openUrlPopup = useCallback(() => {
    // บันทึก selection ก่อน editor เสีย focus
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
    setUrlInput('');
    setSelMenu(null);
    setShowInsertMenu(false);
    urlPopupJustOpenedRef.current = true;
    setShowUrlPopup(true);
  }, []);

  const handleInsertUrl = useCallback(() => {
    let url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const safe = url.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const html = `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;word-break:break-all">${safe}</a>`;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
      document.execCommand('insertHTML', false, html);
      syncContent();
    }
    setShowUrlPopup(false);
    setUrlInput('');

    // ดึง og:image ใน background — ถ้ามีให้เพิ่มเข้า images panel
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/og?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.image) {
          setImages((prev) => {
            if (prev.includes(data.image)) return prev;
            return [...prev, data.image];
          });
          dirtyRef.current = true;
        }
      })
      .catch(() => {});
  }, [urlInput, syncContent]);

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

  // landscape + มีรูปหรือมี relate → right panel แทน gallery bar ด้านล่าง
  const showRightPanel = isLandscape && (allImages.length > 0 || hasRelates);

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, flexDirection: isLandscape ? 'row' : 'column' }}>
        {/* Left column (หรือ full column ใน portrait) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', paddingTop: sat }}>
        {/* Sticky: Related Notes — ซ่อนใน landscape เพราะย้ายไป right panel */}
        {!showRightPanel && (
          <RelatePanel note={{ ...note, refs }} onNavigate={(n) => setPreviewNote(n)} onRemove={removeRef} />
        )}

        {/* Sticky: Toolbar */}
        <div style={styles.toolbar}>
          <button style={{ ...styles.toolBtn, fontSize: `clamp(${11+d}px, 3.2vw, ${15+d}px)` }} onClick={handleAddAI}>✦ AI</button>
          <div style={{ position: 'relative' }}>
            <button style={{ ...styles.toolBtn, fontSize: 18 + d }} onClick={() => { setSelMenu(null); setShowInsertMenu(!showInsertMenu); }}>+</button>
            {showInsertMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowInsertMenu(false)} />
                <div style={styles.insertMenu}>
                  <button style={styles.insertOption} onClick={() => { setShowInsertMenu(false); handleImageUpload(); }}>{t('editor.insertImage')}</button>
                  <button style={styles.insertOption} onClick={() => { openUrlPopup(); }}>
                    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'#0ea5e9', marginRight:6, flexShrink:0, verticalAlign:'middle' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </span>URL
                  </button>
                  <button style={styles.insertOption} onClick={() => { setShowInsertMenu(false); setShowRefer(true); }}>
                    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'#22c55e', marginRight:6, flexShrink:0, verticalAlign:'middle' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                    </span>{t('editor.insertRef')}
                  </button>
                  <button style={styles.insertOption} onClick={() => { setShowInsertMenu(false); handleAddAccordion(); }}>{t('editor.insertBox')}</button>
                  <button style={styles.insertOption} onClick={handleAddTagAction}>{t('editor.insertTag')}</button>
                </div>
              </>
            )}
          </div>
          <FormatMenu onFormat={handleFormat} onOpen={() => setSelMenu(null)} />
          <button
            style={{ ...styles.toolBtn, fontSize: `clamp(${11+d}px, 3.2vw, ${15+d}px)`, marginLeft: 'auto', color: pinned ? C.amber : C.muted }}
            onClick={() => setPinned(!pinned)}
          >
            📌
          </button>
          {!isNew && (
            <button
              style={{ ...styles.toolBtn, fontSize: `clamp(${11+d}px, 3.2vw, ${15+d}px)` }}
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
            placeholder={t('editor.titlePlaceholder')}
            value={title}
            onChange={(e) => { dirtyRef.current = true; setTitle(e.target.value); }}
            style={styles.titleInput}
          />

          <div
            ref={textareaRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={t('editor.contentPlaceholder')}
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
            style={{ ...styles.textarea, fontSize: 16 + d, lineHeight: 1.7 + d * 0.02, WebkitUserSelect: 'text', WebkitTouchCallout: 'none' }}
          />

          {/* Render AI Blocks as popup overlay */}
          {aiBlocks.filter((b) => b.type !== 'accordion').length > 0 && (
            <AIOverlay>
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
            </AIOverlay>
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

        {/* Image Gallery Bar — ซ่อนเมื่อ landscape มี right panel แล้ว */}
        {hasGallery && !showRightPanel && (
          <div style={styles.galleryBar} ref={galleryRef}>
            <div style={styles.galleryScroll}>
              {allImages.map((src, i) => (
                <CachedImage
                  key={i}
                  src={src}
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
          <FullscreenViewer src={fullscreenImg} onClose={() => setFullscreenImg(null)} />
        )}

        {/* Sticky: Footer */}
        <div style={{ ...styles.footer, paddingBottom: 10 + sab }}>
          {/* Tag chips row — ซ่อน internal tags (_line_id, _line_trim, etc.) */}
          <div style={styles.tagRow}>
            {tags.filter(t => !t.startsWith('_')).map((tag) => (
              <span key={tag} style={{ ...styles.tagChip, fontSize: [12, 16, 18][fsLevel - 1] }}>
                <span style={styles.tagChipLabel}>{tag}</span>
                <button style={styles.tagChipRemove} onClick={() => { setTags(tags.filter(t => t !== tag)); dirtyRef.current = true; }}>✕</button>
              </span>
            ))}
            <input
              ref={tagInputRef}
              placeholder={t('editor.addTag')}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              style={{ ...styles.tagInlineInput, fontSize: 12 + d }}
            />
          </div>
          {/* Bottom row: info + buttons */}
          <div style={styles.footerBottom}>
            {!isNew && lastSaved && (
              <span style={{ ...styles.saveInfo, fontSize: 11 + d }}>
                {t('editor.updated')} {new Date(lastSaved).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' })}
                {' ver '}{(note?.history?.length || 0) + 1}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button style={{ ...styles.cancelBtn, fontSize: 15 + d }} onClick={() => { doAutoSave(); onClose(); }}>{t('editor.exit')}</button>
            <button style={{ ...styles.saveBtn, fontSize: 15 + d }} onClick={handleSave}>{t('editor.save')}</button>
          </div>
        </div>

        {showRefer && (
          <ReferModal
            noteId={note?.id}
            currentRefs={refs}
            onSelect={handleRefer}
            onClose={() => setShowRefer(false)}
          />
        )}

        {/* Tag picker popup */}
        {showTagPicker && (
          <div style={styles.tagPickerOverlay} onClick={() => setShowTagPicker(false)}>
            <div style={styles.tagPickerPopup} onClick={(e) => e.stopPropagation()}>
              <div style={styles.tagPickerTitle}>{t('editor.addTagTitle')}</div>
              <div style={styles.tagPickerInputRow}>
                <input
                  autoFocus
                  placeholder={t('editor.tagInputPlaceholder')}
                  value={tagPickerSearch}
                  onChange={(e) => setTagPickerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagPickerSearch.trim()) {
                      handleAddTag(tagPickerSearch.trim());
                      setShowTagPicker(false);
                    }
                  }}
                  style={styles.tagPickerInput}
                />
                <button
                  style={styles.tagPickerAddBtn}
                  onClick={() => { if (tagPickerSearch.trim()) { handleAddTag(tagPickerSearch.trim()); setShowTagPicker(false); } }}
                >
                  {t('editor.addTagBtn')}
                </button>
              </div>
              <div style={styles.tagPickerList}>
                {[...new Set([
                  ...state.notes.flatMap(n => n.tags || []),
                  ...state.todos.flatMap(t => t.tags || []),
                ]).values()]
                  .filter(t => !t.startsWith('_') && !tags.includes(t) && (!tagPickerSearch.trim() || t.toLowerCase().includes(tagPickerSearch.toLowerCase())))
                  .sort()
                  .map((t) => (
                    <button
                      key={t}
                      style={styles.tagPickerItem}
                      onClick={() => { handleAddTag(t); setShowTagPicker(false); }}
                    >
                      #{t}
                    </button>
                  ))
                }
                {[...new Set([...state.notes.flatMap(n => n.tags || []), ...state.todos.flatMap(t => t.tags || [])])].filter(t => !t.startsWith('_') && !tags.includes(t)).length === 0 && !tagPickerSearch && (
                  <p style={styles.tagPickerEmpty}>{t('editor.noTagsYet')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Custom selection menu */}
        {selMenu && (
          <div ref={selMenuRef} style={{
            ...styles.selMenuBar,
            left: selMenu.x,
            top: selMenu.y,
          }}>
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleCustomCut(); }}>{t('editor.cut')}</button>
            <span style={styles.selMenuDivider} />
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleCustomCopy(); }}>{t('editor.copy')}</button>
            <span style={styles.selMenuDivider} />
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleCustomPaste(); }}>{t('editor.paste')}</button>
            <span style={styles.selMenuDivider} />
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleAddAI(); setSelMenu(null); }}>✦ AI</button>
            <span style={styles.selMenuDivider} />
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); handleAddAccordion(); setSelMenu(null); }}>≡▼</button>
            <span style={styles.selMenuDivider} />
            <button style={styles.selMenuBtn} onPointerDown={(e) => { e.preventDefault(); openUrlPopup(); }}>URL</button>
          </div>
        )}

        {/* URL insert popup */}
        {showUrlPopup && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}
            onClick={() => {
              if (urlPopupJustOpenedRef.current) { urlPopupJustOpenedRef.current = false; return; }
              setShowUrlPopup(false);
            }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 16px', width: 'min(90vw, 360px)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1c1917' }}>{t('editor.insertUrl')}</div>
              <input
                autoFocus
                type="url"
                inputMode="url"
                placeholder={t('editor.urlPlaceholder')}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInsertUrl(); if (e.key === 'Escape') setShowUrlPopup(false); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowUrlPopup(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d6d3d1', background: 'transparent', fontSize: 14, cursor: 'pointer' }}>{t('common.cancel')}</button>
                <button onClick={handleInsertUrl} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0284c7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('editor.insert')}</button>
              </div>
            </div>
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
                  {t('editor.editNote')}
                </button>
                <div style={styles.previewTitle}>{previewNote.title || 'Untitled'}</div>
                <button style={styles.previewCloseBtn} onClick={() => setPreviewNote(null)}>✕</button>
              </div>
              <div
                style={styles.previewBody}
                dangerouslySetInnerHTML={{ __html: previewNote.content || `<p style="color:#a8a29e">${t('editor.noContent')}</p>` }}
              />
            </div>
          </div>
        )}
        </div>{/* end left column */}

        {/* Right panel: relate + รูปทั้งหมดใน landscape mode */}
        {showRightPanel && (
          <div style={styles.rightPanel}>
            <div style={styles.rightPanelScroll}>
              {/* RelatePanel อยู่ด้านบน */}
              <RelatePanel note={{ ...note, refs }} onNavigate={(n) => setPreviewNote(n)} onRemove={removeRef} />
              {/* รูปภาพ */}
              {allImages.map((src, i) => (
                <CachedImage
                  key={i}
                  src={src}
                  style={styles.rightPanelImg}
                  onClick={() => setFullscreenImg(src)}
                />
              ))}
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
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 150,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 16,
    overflowY: 'auto',
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
    flexDirection: 'column',
    paddingTop: 8,
    paddingRight: 14,
    paddingBottom: 'calc(10px + var(--sab, env(safe-area-inset-bottom, 0px)))',
    paddingLeft: 14,
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
    position: 'sticky',
    bottom: 0,
    gap: 6,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
    minHeight: 28,
  },
  tagChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    background: C.amberLight,
    borderRadius: 12,
    padding: '2px 8px 2px 8px',
    fontSize: 12,
    fontWeight: 500,
  },
  tagChipLabel: { color: C.amber, cursor: 'default' },
  tagChipRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: C.muted, fontSize: 11, padding: '0 0 0 2px', lineHeight: 1,
  },
  tagInlineInput: {
    border: 'none', outline: 'none', background: 'transparent',
    fontSize: 12, color: C.sub, fontFamily: C.font,
    minWidth: 60, flex: 1,
    padding: '2px 0',
  },
  footerBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  tagPickerOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  tagPickerPopup: {
    background: C.bg,
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  tagPickerTitle: {
    fontSize: 15, fontWeight: 600, color: C.text,
    marginBottom: 10, fontFamily: C.font,
  },
  tagPickerInputRow: {
    display: 'flex', gap: 8, marginBottom: 10,
  },
  tagPickerInput: {
    flex: 1, padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 14,
    fontFamily: C.font, outline: 'none',
  },
  tagPickerAddBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: C.amber, color: C.white, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: C.font,
  },
  tagPickerList: {
    overflowY: 'auto', flex: 1,
    display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start',
  },
  tagPickerItem: {
    padding: '6px 14px', borderRadius: 20,
    border: `1px solid ${C.border}`, background: C.white,
    fontSize: 13, cursor: 'pointer', fontFamily: C.font, color: C.sub,
  },
  tagPickerEmpty: {
    fontSize: 13, color: C.muted, width: '100%', textAlign: 'center', padding: 12,
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
    alignItems: 'center',
    gap: 0,
    background: '#f5f5f4',
    borderRadius: 10,
    padding: '2px 4px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    border: '1px solid #d6d3d1',
    zIndex: 200,
  },
  selMenuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#44403c',
    fontSize: 14,
    padding: '10px 12px',
    cursor: 'pointer',
    fontFamily: C.font,
    whiteSpace: 'nowrap',
    borderRadius: 8,
    minHeight: 44,
  },
  selMenuDivider: {
    width: 1,
    height: 20,
    background: '#d6d3d1',
    flexShrink: 0,
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
  rightPanel: {
    width: '38%',
    borderLeft: `1px solid ${C.border}`,
    background: C.bg,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    paddingTop: 'var(--sat, env(safe-area-inset-top, 0px))',
    paddingBottom: 'var(--sab, env(safe-area-inset-bottom, 0px))',
  },
  rightPanelScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
  },
  rightPanelImg: {
    width: '100%',
    borderRadius: 8,
    display: 'block',
    cursor: 'pointer',
  },
};
