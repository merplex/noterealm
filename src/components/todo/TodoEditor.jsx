import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { QUICK_PICKS, calcDate } from './DatePickerPopup';
import { format } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { useLocale } from '../../utils/useLocale';
import { useFontSize } from '../../utils/useFontSize';

const PRIORITY_KEYS = ['urgent', 'high', 'normal', 'low'];

export default function TodoEditor({ todo, onClose }) {
  const { state, actions } = useApp();
  const { t, locale } = useLocale();
  const dfLocale = locale === 'en' ? enUS : th;
  const fd = (useFontSize() - 1) * 2;
  const isNew = !todo?.id;

  const [title, setTitle] = useState(todo?.title || '');
  const [note, setNote] = useState(todo?.note || '');
  const [priority, setPriority] = useState(todo?.priority || 'normal');
  const [dueDate, setDueDate] = useState(todo?.dueDate || '');
  const [dueTime, setDueTime] = useState(todo?.dueTime || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(todo?.tags || []);
  const [showNoteConfirm, setShowNoteConfirm] = useState(false);
  const [showLinkNote, setShowLinkNote] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [linkedNoteExpanded, setLinkedNoteExpanded] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');

  const linkedNote = useMemo(() => {
    if (!todo?.linkedNoteId) return null;
    return state.notes.find((n) => n.id === todo.linkedNoteId) || null;
  }, [todo?.linkedNoteId, state.notes]);

  const filteredNotes = useMemo(() => {
    if (!showLinkNote) return [];
    const q = noteSearch.toLowerCase();
    return state.notes.filter((n) =>
      !q || n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [showLinkNote, noteSearch, state.notes]);

  const handleAddToNote = async () => {
    try {
      await actions.addNote({
        id: uuidv4(),
        title: title.trim() || todo?.title || t('todoEditor.fromTodo'),
        content: `<p>${note.trim() || title.trim() || ''}</p>`,
        tags: [],
        pinned: false,
        images: [],
        aiBlocks: [],
        archived: false,
        source: 'manual',
        history: [],
        refs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setShowNoteConfirm(false);
      alert(t('todoEditor.addNoteSuccess'));
    } catch (err) {
      alert(t('todoEditor.addNoteFailed') + err.message);
    }
  };

  const handleLinkNote = async (noteId) => {
    if (todo?.id) {
      try {
        await actions.updateTodo({ ...todo, linkedNoteId: noteId });
      } catch (err) {
        alert(t('todoEditor.linkFailed') + err.message);
      }
    }
    setShowLinkNote(false);
  };

  const handleUnlink = async () => {
    if (todo?.id) {
      try {
        await actions.updateTodo({ ...todo, linkedNoteId: undefined });
      } catch (err) {
        alert(t('todoEditor.unlinkFailed') + err.message);
      }
    }
    setShowUnlinkConfirm(false);
    setLinkedNoteExpanded(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    const data = {
      id: todo?.id || uuidv4(),
      title: title.trim(),
      note: note.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      tags,
      done: todo?.done || false,
      linkedNoteId: todo?.linkedNoteId,
      source: todo?.source || 'manual',
      createdAt: todo?.createdAt || new Date().toISOString(),
    };

    try {
      if (isNew) {
        await actions.addTodo(data);
      } else {
        await actions.updateTodo(data);
      }
      onClose();
    } catch (err) {
      alert(t('todoEditor.saveFailed') + err.message);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ ...styles.headerTitle, fontSize: 16 + fd }}>{isNew ? t('todoEditor.create') : t('todoEditor.edit')}</h3>
          {!isNew && (
            <div style={styles.headerActions}>
              <button style={{ ...styles.headerActionBtn, fontSize: 11 + fd }} onClick={() => setShowNoteConfirm(true)}>
                📝 {t('editor.addNote')}
              </button>
              <button style={{ ...styles.headerActionBtn, fontSize: 11 + fd }} onClick={() => { setShowLinkNote(true); setNoteSearch(''); }}>
                🔗 {t('editor.linkNote')}
              </button>
            </div>
          )}
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <input
            type="text"
            placeholder={t('todoEditor.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...styles.titleInput, fontSize: 16 + fd}}
            autoFocus={isNew}
          />

          <textarea
            placeholder={t('todoEditor.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...styles.noteInput, fontSize: 13 + fd }}
            rows={3}
          />

          {/* Priority */}
          <label style={{ ...styles.label, fontSize: 12 + fd }}>{t('todoEditor.priority')}</label>
          <div style={styles.priorityRow}>
            {PRIORITY_KEYS.map((key) => (
              <button
                key={key}
                style={{
                  ...styles.priorityBtn,
                  fontSize: 12 + fd,
                  background: priority === key ? PRIORITY_COLORS[key] + '20' : C.white,
                  borderColor: priority === key ? PRIORITY_COLORS[key] : C.border,
                }}
                onClick={() => setPriority(key)}
              >
                {t(`priority.${key}Label`)}
              </button>
            ))}
          </div>

          {/* Quick pick dates */}
          <label style={{ ...styles.label, fontSize: 12 + fd }}>{t('todoEditor.dueDateSection')}</label>
          <div style={styles.quickPickRow}>
            {QUICK_PICKS.map((pick) => {
              const d = calcDate(pick);
              return (
                <button
                  key={pick.label}
                  style={{
                    ...styles.quickPickBtn,
                    fontSize: 11 + fd,
                    background: dueDate === d ? C.amber : C.white,
                    color: dueDate === d ? C.white : C.text,
                    borderColor: dueDate === d ? C.amber : C.border,
                  }}
                  onClick={() => setDueDate(d)}
                >
                  {pick.label}
                </button>
              );
            })}
            <button
              style={{
                ...styles.quickPickBtn,
                fontSize: 11 + fd,
                background: !dueDate ? '#f0f0f0' : C.white,
                color: C.sub,
                borderColor: C.border,
              }}
              onClick={() => { setDueDate(''); setDueTime(''); }}
            >
              {t('todoEditor.noDate')}
            </button>
          </div>

          {/* Due date/time */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={{ ...styles.label, fontSize: 12 + fd }}>{t('todoEditor.dueDate')}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ ...styles.input, fontSize: 13 + fd }}
              />
            </div>
            <div style={styles.field}>
              <label style={{ ...styles.label, fontSize: 12 + fd }}>{t('todoEditor.time')}</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                style={{ ...styles.input, fontSize: 13 + fd }}
              />
            </div>
          </div>

          {/* Tags */}
          <label style={{ ...styles.label, fontSize: 12 + fd }}>{t('todoEditor.tags')}</label>
          <div style={styles.tagsWrap}>
            {tags.map((tag) => (
              <span key={tag} style={{ ...styles.tag, fontSize: 11 + fd }}>
                {tag}
                <button
                  style={{ ...styles.tagRemove, fontSize: 14 + fd }}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              style={{ ...styles.tagInput, fontSize: 12 + fd }}
              placeholder={t('todoEditor.tagPlaceholder')}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  setTags([...tags, tagInput.trim()]);
                  setTagInput('');
                }
              }}
            />
          </div>

          {/* Linked Note section */}
          {linkedNote && (
            <div style={styles.linkedBlock}>
            <div
              style={{ ...styles.linkedHeader, fontSize: 13 + fd }}
              onClick={() => setLinkedNoteExpanded(!linkedNoteExpanded)}
            >
              <span style={styles.linkedChevron}>{linkedNoteExpanded ? '▾' : '▸'}</span>
              <span style={styles.linkedIcon}>🔗</span>
              <span style={styles.linkedTitle}>{linkedNote.title || t('todoEditor.noTitle')}</span>
              <button
                style={styles.unlinkBtn}
                onClick={(e) => { e.stopPropagation(); setShowUnlinkConfirm(true); }}
                title={t('todoEditor.unlinkTooltip')}
              >
                ✕
              </button>
            </div>
            {linkedNoteExpanded && (
              <div
                style={styles.linkedContent}
                dangerouslySetInnerHTML={{ __html: linkedNote.content || `<p style="color:#a8a29e">${t('todoEditor.noContent')}</p>` }}
              />
            )}
          </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={{ ...styles.cancelBtn, fontSize: 13 + fd }} onClick={onClose}>{t('common.cancel')}</button>
          <button style={{ ...styles.saveBtn, fontSize: 13 + fd }} onClick={handleSave}>{t('common.save')}</button>
        </div>
      </div>

      {/* Confirm unlink */}
      {showUnlinkConfirm && (
        <div style={styles.subOverlay} onClick={() => setShowUnlinkConfirm(false)}>
          <div style={styles.subPopup} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.subTitle, fontSize: 15 + fd }}>{t('todoEditor.unlinkTitle')}</div>
            <p style={{ ...styles.subText, fontSize: 13 + fd }}>{t('todoEditor.unlinkText').replace('{title}', linkedNote?.title || t('todoEditor.noTitle'))}</p>
            <div style={styles.subFooter}>
              <button style={{ ...styles.cancelBtn, fontSize: 13 + fd }} onClick={() => setShowUnlinkConfirm(false)}>{t('common.cancel')}</button>
              <button style={{ ...styles.saveBtn, fontSize: 13 + fd }} onClick={handleUnlink}>{t('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm add to note */}
      {showNoteConfirm && (
        <div style={styles.subOverlay} onClick={() => setShowNoteConfirm(false)}>
          <div style={styles.subPopup} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.subTitle, fontSize: 15 + fd }}>{t('editor.confirmAddNote')}</div>
            <p style={{ ...styles.subText, fontSize: 13 + fd }}>{t('editor.confirmAddNoteText')} "{title || todo?.title}"</p>
            <div style={styles.subFooter}>
              <button style={{ ...styles.cancelBtn, fontSize: 13 + fd }} onClick={() => setShowNoteConfirm(false)}>{t('common.cancel')}</button>
              <button style={{ ...styles.saveBtn, fontSize: 13 + fd }} onClick={handleAddToNote}>{t('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Link note picker */}
      {showLinkNote && (
        <div style={styles.subOverlay} onClick={() => setShowLinkNote(false)}>
          <div style={styles.subPopup} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.subTitle, fontSize: 15 + fd }}>{t('editor.linkNoteTitle')}</div>
            <input
              style={{ ...styles.searchInput, fontSize: 14 + fd }}
              placeholder={t('editor.searchNote')}
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              autoFocus
            />
            <div style={styles.noteList}>
              {filteredNotes.length === 0 ? (
                <p style={{ fontSize: 13 + fd, color: C.muted, textAlign: 'center', padding: 16 }}>{t('editor.noNote')}</p>
              ) : (
                filteredNotes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      ...styles.noteItem,
                      background: todo?.linkedNoteId === n.id ? C.amberLight : C.white,
                    }}
                    onClick={() => handleLinkNote(n.id)}
                  >
                    <span style={{ ...styles.noteItemTitle, fontSize: 13 + fd }}>{n.title || t('todoEditor.noTitle')}</span>
                    <span style={{ ...styles.noteItemDate, fontSize: 11 + fd }}>
                      {format(new Date(n.updatedAt || n.createdAt), 'd MMM', { locale: dfLocale })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={styles.subFooter}>
              <button style={{ ...styles.cancelBtn, fontSize: 13 + fd }} onClick={() => setShowLinkNote(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: C.bg,
    borderRadius: 14,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px 10px',
    borderBottom: `1px solid ${C.border}`,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: 4,
    marginLeft: 'auto',
  },
  headerActionBtn: {
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.text,
    whiteSpace: 'nowrap',
  },
  headerTitle: { fontSize: 16, fontWeight: 600, color: C.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted },
  body: { flex: 1, overflowY: 'auto', padding: 16 },
  titleInput: {
    width: '100%',
    fontSize: 16,
    fontWeight: 500,
    border: 'none',
    outline: 'none',
    fontFamily: C.font,
    color: C.text,
    background: 'transparent',
    marginBottom: 10,
  },
  noteInput: {
    width: '100%',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontFamily: C.font,
    color: C.text,
    outline: 'none',
    resize: 'none',
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: 500, color: C.sub, marginBottom: 6, display: 'block' },
  priorityRow: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  priorityBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
    background: C.white,
  },
  quickPickRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 },
  quickPickBtn: {
    padding: '6px 4px',
    borderRadius: 14,
    border: '1px solid',
    fontSize: 11,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    fontFamily: C.font,
    fontWeight: 500,
  },
  row: { display: 'flex', gap: 12, marginBottom: 14 },
  field: { flex: 1 },
  input: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontFamily: C.font,
    outline: 'none',
  },
  tagsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    marginBottom: 10,
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
  tagRemove: { background: 'none', border: 'none', cursor: 'pointer', color: C.amberDark, fontSize: 14, padding: 0 },
  tagInput: { border: 'none', outline: 'none', fontSize: 12, fontFamily: C.font, width: 60, background: 'transparent' },
  linkedBlock: {
    margin: '10px 0',
    background: C.white,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  linkedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 12px',
    background: '#f5f5f4',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
  },
  linkedChevron: { fontSize: 12, color: C.muted, width: 12 },
  linkedIcon: { fontSize: 14 },
  linkedTitle: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  unlinkBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: C.muted,
    padding: '0 4px',
    flexShrink: 0,
  },
  linkedContent: {
    padding: '10px 14px',
    fontSize: 13,
    color: C.text,
    lineHeight: 1.5,
    maxHeight: 300,
    overflowY: 'auto',
    borderTop: `1px solid ${C.border}`,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '10px 16px',
    borderTop: `1px solid ${C.border}`,
  },
  cancelBtn: {
    padding: '7px 16px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: C.font,
    color: C.sub,
  },
  saveBtn: {
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
  subOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 210,
  },
  subPopup: {
    background: C.bg,
    borderRadius: 14,
    width: '88%',
    maxWidth: 380,
    padding: 16,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
  },
  subTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
    marginBottom: 10,
    fontFamily: C.font,
  },
  subText: {
    fontSize: 13,
    color: C.sub,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  subFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    fontFamily: C.font,
    outline: 'none',
    marginBottom: 8,
  },
  noteList: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 250,
  },
  noteItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    borderRadius: 6,
    marginBottom: 2,
  },
  noteItemTitle: { flex: 1, fontSize: 13, color: C.text },
  noteItemDate: { fontSize: 11, color: C.sub },
};
