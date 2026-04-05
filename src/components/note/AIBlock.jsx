import { useState, useEffect, useRef } from 'react';
import { C } from '../../constants/theme';
import { AI_PROVIDERS, getEnabledProviders } from '../../constants/providers';
import { callAI } from '../../utils/callAI';
import { startOAuth, getOAuthProvider } from '../../utils/oauth';
import { useApp } from '../../context/AppContext';

export default function AIBlock({ block, wrappedContent, onUpdate, onDismiss }) {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  const providerId = block.provider || 'claude';
  const provider = AI_PROVIDERS[providerId] || AI_PROVIDERS.claude;
  const enabledProviders = getEnabledProviders();
  const messages = block.messages || [];
  const hasWrapped = !!wrappedContent;
  const autoSentRef = useRef(false);

  // Auto-send if the selected text was a question
  useEffect(() => {
    if (block.autoSend && !autoSentRef.current && messages.length === 0) {
      autoSentRef.current = true;
      handleSend(block.autoSend);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const needsAuth = provider.authType === 'oauth' && !state.aiSettings?.[`${providerId}Token`];

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const oauthProvider = getOAuthProvider(providerId);
      const tokens = await startOAuth(oauthProvider);
      dispatch({
        type: 'SET_AI_SETTINGS',
        payload: {
          ...state.aiSettings,
          [`${providerId}Token`]: tokens.accessToken,
          [`${providerId}RefreshToken`]: tokens.refreshToken,
        },
      });
    } catch (err) {
      console.error('OAuth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const switchProvider = (newId) => {
    onUpdate({ ...block, provider: newId });
    setShowProviderPicker(false);
  };

  const handleSend = async (text) => {
    if (!text?.trim()) return;
    const newMsg = { role: 'user', content: text.trim() };
    const updatedMsgs = [...messages, newMsg];
    onUpdate({ ...block, messages: updatedMsgs });
    setInput('');
    setLoading(true);

    try {
      const aiResponse = await callAI({
        provider: providerId,
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
      {/* Header with provider selector */}
      <div style={styles.header}>
        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.badge, background: provider.color + '20', color: provider.color }}
            onClick={() => enabledProviders.length > 1 && setShowProviderPicker(!showProviderPicker)}
          >
            {provider.icon} {provider.label} {enabledProviders.length > 1 ? '▾' : ''}
          </button>

          {/* Provider picker dropdown */}
          {showProviderPicker && (
            <div style={styles.providerDropdown}>
              {enabledProviders.map((p) => (
                <button
                  key={p.id}
                  style={{
                    ...styles.providerOption,
                    background: p.id === providerId ? p.color + '15' : 'transparent',
                  }}
                  onClick={() => switchProvider(p.id)}
                >
                  <span style={{ color: p.color }}>{p.icon}</span>
                  <span>{p.label}</span>
                  {p.authType === 'oauth' && (
                    <span style={styles.authHint}>
                      {state.aiSettings?.[`${p.id}Token`] ? '✓' : 'Sign in'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
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

      {/* Sign in prompt or Input */}
      {needsAuth ? (
        <div style={styles.signInPrompt}>
          <p style={styles.signInText}>
            กด Sign in เพื่อใช้ {provider.label}
          </p>
          <button
            style={{ ...styles.signInBtn, background: provider.color }}
            onClick={handleSignIn}
            disabled={loading}
          >
            {loading ? 'กำลังเชื่อมต่อ...' : `Sign in with ${provider.oauthProvider === 'google' ? 'Google' : provider.label}`}
          </button>
        </div>
      ) : (
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
      )}
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
    border: 'none',
    cursor: 'pointer',
    fontFamily: C.font,
  },
  providerDropdown: {
    position: 'absolute',
    top: 30,
    left: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 4,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    minWidth: 160,
  },
  providerOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: C.font,
    textAlign: 'left',
  },
  authHint: {
    marginLeft: 'auto',
    fontSize: 10,
    color: C.muted,
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
  signInPrompt: {
    padding: '16px 12px',
    textAlign: 'center',
    borderTop: `1px solid ${C.border}`,
  },
  signInText: {
    fontSize: 13,
    color: C.sub,
    marginBottom: 10,
  },
  signInBtn: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: C.font,
  },
};
