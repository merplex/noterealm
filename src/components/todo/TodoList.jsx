import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { C, PRIORITY_COLORS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';
import TodoItem from './TodoItem';
import TodoEditor from './TodoEditor';
import DatePickerPopup from './DatePickerPopup';
import { parseQuery, matchQuery } from '../../utils/searchQuery';

const SECTIONS = [
  { key: 'urgent', label: '🔴 เร่งด่วน' },
  { key: 'high', label: '🟠 สำคัญ' },
  { key: 'normal', label: '🟡 ปกติ' },
  { key: 'low', label: '⚪ ต่ำ' },
];

const PRIORITY_LABELS = { urgent: 'เร่งด่วน', high: 'สำคัญ', normal: 'ปกติ', low: 'ต่ำ' };

export default function TodoList({ searchText, todoFilter, onTodoFilter, priorityFilter, onPriorityFilter, todoTagFilter }) {
  const { state, actions } = useApp();
  const { t } = useLocale();
  const d = (useFontSize() - 1) * 2;
  const isGrid = state.todoViewMode === 'grid';
  const isDeletedView = todoFilter === 'deleted';
  const [collapsed, setCollapsed] = useState({});
  const [editingTodo, setEditingTodo] = useState(null);
  const [datePickTodo, setDatePickTodo] = useState(null);
  const [quickAdd, setQuickAdd] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isSelecting = selectedIds.size > 0;

  // ล้าง selection เมื่อ filter เปลี่ยน
  useEffect(() => {
    setSelectedIds(new Set());
  }, [todoFilter]);

  const filteredTodos = useMemo(() => {
    let todos = [...state.todos];

    if (isDeletedView) {
      todos = todos.filter((t) => t.deletedAt);
      todos.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
      return todos;
    }

    // Normal view: exclude deleted
    todos = todos.filter((t) => !t.deletedAt);

    if (searchText) {
      const pq = parseQuery(searchText);
      todos = todos.filter((t) =>
        matchQuery(t.title, pq) || matchQuery(t.note, pq)
      );
    }

    if (priorityFilter) {
      todos = todos.filter((t) => t.priority === priorityFilter);
    }

    if (todoTagFilter) {
      todos = todos.filter((t) => (t.tags || []).includes(todoTagFilter));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    todos.sort((a, b) => {
      const aDate = a.dueDate ? new Date(a.dueDate) : null;
      const bDate = b.dueDate ? new Date(b.dueDate) : null;
      const aGroup = (aDate && aDate < today) ? 0 : !aDate ? 1 : 2;
      const bGroup = (bDate && bDate < today) ? 0 : !bDate ? 1 : 2;
      if (aGroup !== bGroup) return aGroup - bGroup;
      if (aDate && bDate) return aDate - bDate;
      return 0;
    });
    return todos;
  }, [state.todos, searchText, isDeletedView, priorityFilter, todoTagFilter]);

  const toggleCollapse = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggle = (todo) => {
    const newDone = !todo.done;
    actions.updateTodo({
      ...todo,
      done: newDone,
      completedAt: newDone ? new Date().toISOString() : undefined,
    }).catch(console.error);
  };

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return;
    try {
      await actions.addTodo({
        id: uuidv4(),
        title: quickAdd.trim(),
        priority: 'normal',
        done: false,
        source: 'manual',
        createdAt: new Date().toISOString(),
      });
      setQuickAdd('');
    } catch (err) {
      alert('เพิ่มไม่สำเร็จ: ' + err.message);
    }
  };

  // Selection
  const handleLongPress = (todo) => {
    setSelectedIds(new Set([todo.id]));
  };
  const handleSelect = (todo) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(todo.id)) next.delete(todo.id);
      else next.add(todo.id);
      return next;
    });
  };
  const cancelSelection = () => setSelectedIds(new Set());

  const handleDelete = async () => {
    await Promise.all([...selectedIds].map((id) => actions.deleteTodo(id)));
    cancelSelection();
  };
  const handleRestore = async () => {
    await Promise.all([...selectedIds].map((id) => actions.restoreTodo(id)));
    cancelSelection();
  };
  const handlePermanentDelete = async () => {
    await Promise.all([...selectedIds].map((id) => actions.permanentDeleteTodo(id)));
    cancelSelection();
  };

  const todoItemProps = (todo) => ({
    todo,
    onToggle: handleToggle,
    onEdit: setEditingTodo,
    onDateClick: setDatePickTodo,
    isSelecting,
    isSelected: selectedIds.has(todo.id),
    onLongPress: handleLongPress,
    onSelect: handleSelect,
  });

  return (
    <div style={styles.container}>
      {/* Deleted view header */}
      {isDeletedView && (
        <div style={styles.deletedHeader}>
          <button style={styles.backBtn} onClick={() => onTodoFilter?.(null)}>{t('todo.backFromTrash')}</button>
          <span style={styles.deletedTitle}>{t('todo.trash')}</span>
        </div>
      )}

      {/* Quick add bar — ซ่อนใน deleted view */}
      {!isDeletedView && (
        <div style={styles.quickAdd}>
          <input
            type="text"
            placeholder={t('todo.quickAdd')}
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
            style={{ ...styles.quickInput, fontSize: 14 + d }}
          />
          <button style={styles.quickBtn} onClick={handleQuickAdd}>{t('todo.add')}</button>
        </div>
      )}

      {/* Priority filter chips */}
      {!isDeletedView && (
        <div style={styles.filterRow}>
          {SECTIONS.map((s) => {
            const active = priorityFilter === s.key;
            return (
              <button
                key={s.key}
                style={{
                  ...styles.filterChip,
                  fontSize: 12 + d,
                  background: active ? C.amber : C.white,
                  color: active ? C.white : C.sub,
                  borderColor: active ? C.amber : C.border,
                }}
                onClick={() => onPriorityFilter?.(active ? null : s.key)}
              >
                {s.key === 'urgent' ? t('priority.urgentLabel') : s.key === 'high' ? t('priority.highLabel') : s.key === 'normal' ? t('priority.normalLabel') : t('priority.lowLabel')}
              </button>
            );
          })}
        </div>
      )}

      <div style={styles.list}>
        {isGrid && !isDeletedView ? (
          filteredTodos.length === 0 ? (
            <div style={styles.empty}>
              {searchText ? t('todo.notFound') : t('todo.empty')}
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  style={{
                    ...styles.gridCard,
                    opacity: todo.done ? 0.5 : 1,
                    borderLeftColor: PRIORITY_COLORS[todo.priority] || C.muted,
                  }}
                  onClick={() => setEditingTodo(todo)}
                >
                  <div style={styles.gridCardHeader}>
                    <button
                      style={{
                        ...styles.gridCb,
                        background: todo.done ? C.amber : 'transparent',
                        borderColor: todo.done ? C.amber : C.border,
                      }}
                      onClick={(e) => { e.stopPropagation(); handleToggle(todo); }}
                    >
                      {todo.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </button>
                    <span style={{ ...styles.gridTitle, fontSize: 13 + d, textDecoration: todo.done ? 'line-through' : 'none' }}>
                      {todo.title}
                    </span>
                  </div>
                  {todo.note && <p style={{ ...styles.gridNote, fontSize: 11 + d }}>{todo.note}</p>}
                  <div style={styles.gridMeta}>
                    <span style={{
                      ...styles.gridPriority,
                      fontSize: 10 + d,
                      background: (PRIORITY_COLORS[todo.priority] || C.muted) + '20',
                      color: PRIORITY_COLORS[todo.priority] || C.muted,
                    }}>
                      {t(`priority.${todo.priority}`) || t('priority.normal')}
                    </span>
                    <span style={{ ...styles.gridDate, fontSize: 10 + d }} onClick={(e) => { e.stopPropagation(); setDatePickTodo(todo); }}>
                      {todo.dueDate
                        ? new Date(todo.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                          + (todo.dueTime ? ` ${todo.dueTime}` : '')
                        : t('todo.noDate')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {isDeletedView ? (
              // Deleted todos — flat list
              filteredTodos.length === 0 ? (
                <div style={styles.empty}>{t('todo.emptyTrash')}</div>
              ) : (
                filteredTodos.map((todo) => (
                  <TodoItem key={todo.id} {...todoItemProps(todo)} />
                ))
              )
            ) : (
              // Normal list grouped by priority
              <>
                {SECTIONS.map((section) => {
                  const todos = filteredTodos.filter((t) => t.priority === section.key);
                  if (todos.length === 0) return null;
                  return (
                    <div key={section.key}>
                      <button style={{ ...styles.sectionHeader, fontSize: 13 + d }} onClick={() => toggleCollapse(section.key)}>
                        <span>{section.key === 'urgent' ? t('priority.urgentLabel') : section.key === 'high' ? t('priority.highLabel') : section.key === 'normal' ? t('priority.normalLabel') : t('priority.lowLabel')}</span>
                        <span style={styles.count}>{todos.length}</span>
                        <span style={styles.chevron}>{collapsed[section.key] ? '▸' : '▾'}</span>
                      </button>
                      {!collapsed[section.key] &&
                        todos.map((todo) => (
                          <TodoItem key={todo.id} {...todoItemProps(todo)} />
                        ))}
                    </div>
                  );
                })}
                {filteredTodos.length === 0 && (
                  <div style={styles.empty}>
                    {searchText ? t('todo.notFound') : t('todo.empty')}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {datePickTodo && (
        <DatePickerPopup
          dueDate={datePickTodo.dueDate}
          dueTime={datePickTodo.dueTime}
          onSave={(date, time) => {
            actions.updateTodo({ ...datePickTodo, dueDate: date, dueTime: time }).catch(console.error);
            setDatePickTodo(null);
          }}
          onCancel={() => setDatePickTodo(null)}
        />
      )}

      {editingTodo && (
        <TodoEditor todo={editingTodo} onClose={() => setEditingTodo(null)} />
      )}

      {/* Bottom action bar */}
      {isSelecting && (
        <div style={styles.actionBar}>
          <div style={styles.actionBarTop}>
            <button style={styles.cancelBtn} onClick={cancelSelection}>{t('todo.cancelSelect')}</button>
            <span style={styles.selectionCount}>{t('todo.selected')} {selectedIds.size} {t('todo.selectedUnit')}</span>
          </div>
          <div style={styles.actionBtns}>
            {isDeletedView ? (
              <>
                <button style={{ ...styles.actionBtn, background: '#dc2626' }} onClick={handlePermanentDelete}>
                  {t('todo.permanentDelete')}
                </button>
                <button style={{ ...styles.actionBtn, background: '#16a34a' }} onClick={handleRestore}>
                  {t('todo.restoreItems')}
                </button>
              </>
            ) : (
              <button style={{ ...styles.actionBtn, background: '#dc2626' }} onClick={handleDelete}>
                {t('todo.deleteItems')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  list: { flex: 1, overflowY: 'auto' },
  deletedHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
    background: '#fef2f2',
  },
  backBtn: {
    background: 'none', border: 'none', fontSize: 14, color: C.sub,
    cursor: 'pointer', padding: 0, fontFamily: C.font,
  },
  deletedTitle: { fontSize: 14, fontWeight: 600, color: '#dc2626' },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '10px 14px', background: '#f5f5f4', border: 'none',
    borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
    fontFamily: C.font, fontSize: 13, fontWeight: 600, color: C.text,
  },
  count: { fontSize: 11, color: C.muted, background: C.white, padding: '1px 6px', borderRadius: 10 },
  chevron: { marginLeft: 'auto', color: C.muted, fontSize: 12 },
  empty: { padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 },
  quickAdd: {
    display: 'flex', gap: 8, padding: '10px 14px',
    borderTop: `1px solid ${C.border}`, background: C.bg,
  },
  quickInput: {
    flex: 1, padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 14, fontFamily: C.font, outline: 'none',
  },
  quickBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: C.amber, color: C.white, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: C.font,
  },
  filterRow: {
    display: 'flex', gap: 6, padding: '6px 14px 8px',
    overflowX: 'auto', whiteSpace: 'nowrap',
  },
  filterChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 12px', borderRadius: 20, border: '1px solid',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: C.font, transition: 'all 0.15s', flexShrink: 0,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: 10 },
  gridCard: {
    background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
    borderLeft: '4px solid', padding: 10, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  gridCardHeader: { display: 'flex', alignItems: 'flex-start', gap: 6 },
  gridCb: {
    width: 18, height: 18, borderRadius: 4, border: '2px solid', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1, background: 'transparent',
  },
  gridTitle: { fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.3, wordBreak: 'break-word' },
  gridNote: {
    fontSize: 11, color: C.sub, lineHeight: 1.3, overflow: 'hidden',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: 0,
  },
  gridMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  gridPriority: { fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600 },
  gridDate: { fontSize: 10, color: C.sub, cursor: 'pointer' },
  actionBar: {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480, background: C.white,
    borderTop: `1px solid ${C.border}`, padding: '12px 16px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    zIndex: 200, boxShadow: '0 -4px 20px rgba(0,0,0,0.10)',
  },
  actionBarTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  selectionCount: { fontSize: 14, fontWeight: 600, color: C.text },
  cancelBtn: {
    background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: C.sub,
    cursor: 'pointer', padding: '4px 0', fontFamily: C.font,
  },
  actionBtns: { display: 'flex', gap: 10 },
  actionBtn: {
    flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: C.font,
  },
};
