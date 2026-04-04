import { useState } from 'react';
import { C } from '../../constants/theme';
import { PROVIDERS } from '../../constants/providers';
import { callAI } from '../../utils/callAI';
import { useApp } from '../../context/AppContext';

export default function AIBlock({ block, wrappedContent, onUpdate, onDismiss }) {
  const { state } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const provider = PROVIDERS[block.provider || 'claude'];
  const messages = block.messages || [];
  const hasWrapped = !!wrappedContent;

  const quickActions = hasWrapped
    ? [
        { label: 'สรุป', prompt: 'สรุปข้อความนี้ให้กระชับ' },
        { label: 'แปลอังกฤษ', prompt: 'แปลเป็นภาษาอังกฤษ' },
        { label: 'ตรวจภาษา', prompt: 'ตรวจสอบและแก้ไขภาษาให้ถูกต้อง' },
      ]
    : [
        { label: 'ช่วยเขียน', prompt: 'ช่วยเขียนเนื้อหาเกี่ยวกับ' },
        { label: 'ไอเดีย', prompt: 'ช่วยคิดไอเดียเกี่ยวกับ' },
        { label: 'อธิบาย', prompt: 'ช่วยอธิบายเรื่อง' },
      ];

  const handleSend = async (text) => {
    if (!text?.trim()) return;
    const newMsg = { role: 'user', content: text.trim() };
    const updatedMsgs = [...messages, newMsg];
    onUpdate({ ...block, messages: updatedMsgs });
    setInput('');
    setLoading(true);

    try {
      const aiResponse = await callAI({
        provider: block.provider || 'claude',
        messages: updatedMsgs,
        wrappedContent,
        settings: state.aiSettings,
      });
      onUpdate({
        ...block,
        messages: [...updatedMsgs, { role: 'assistant', content: aiResponse }],
      });
    } catch (err) {
      onUpdate({
        ...block,
        messages: [...updatedMsgs, { role: 'assistant', content: `⚠️ Error: ${err.message}` }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div style={{ ...styles.container, borderColor: provider.color + '40' }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ ...styles.badge, background: provider.color + '20', color: provider.color }}>
          {provider.icon} {provider.label}
        </span>
        <span style={styles.msgCount}>{messages.length} ข้อความ</span>
        <button style={styles.dismissBtn} onClick={() => onDismiss?.(block)}>
          ✕ Dismiss
        </button>
      </div>

      {/* Wrapped content */}
      {wrappedContent && (
        <div style={styles.wrapped}>
          <div style={styles.wrappedLabel}>📎 ข้อความที่คลุม</div>
          <p style={styles.wrappedText}>{wrappedContent}</p>
        </div>
      )}

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.msg,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? C.amberLight : '#f5f5f4',
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div style={{ ...styles.msg, background: '#f5f5f4' }}>กำลังคิด...</div>}
      </div>

      {/* Quick actions */}
      {messages.length === 0 && (
        <div style={styles.quickActions}>
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              style={styles.quickBtn}
              onClick={() => handleSend(qa.prompt)}
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={styles.inputRow}>
        <textarea
          style={styles.input}
          placeholder="พิมพ์ข้อความ..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          style={{ ...styles.sendBtn, background: provider.color }}
          onClick={() => handleSend(input)}
          disabled={loading}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    border: '1px solid',
    borderRadius: 10,
    margin: '8px 0',
    overflow: 'hidden',
    background: C.white,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: `1px solid ${C.border}`,
  },
  badge: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 6,
    fontWeight: 600,
  },
  msgCount: { flex: 1, fontSize: 11, color: C.muted },
  dismissBtn: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: C.muted,
    cursor: 'pointer',
  },
  wrapped: {
    margin: '8px 12px',
    padding: 10,
    background: '#fefce8',
    borderRadius: 8,
    border: '1px solid #fde68a',
  },
  wrappedLabel: { fontSize: 11, color: C.amberDark, marginBottom: 4 },
  wrappedText: { fontSize: 13, color: C.text, whiteSpace: 'pre-wrap' },
  messages: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 12px',
    maxHeight: 300,
    overflowY: 'auto',
  },
  msg: {
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 10,
    maxWidth: '85%',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  quickActions: {
    display: 'flex',
    gap: 6,
    padding: '6px 12px',
    flexWrap: 'wrap',
  },
  quickBtn: {
    padding: '5px 12px',
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.white,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: C.font,
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderTop: `1px solid ${C.border}`,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    fontFamily: C.font,
    resize: 'none',
    outline: 'none',
    minHeight: 34,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: 'none',
    color: 'white',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 700,
  },
};
