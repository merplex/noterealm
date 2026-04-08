import { useState } from 'react';
import { C } from '../../constants/theme';
import { AI_PROVIDERS, getEnabledProviders } from '../../constants/providers';
import { callAI } from '../../utils/callAI';
import { startOAuth, getOAuthProvider } from '../../utils/oauth';
import { useApp } from '../../context/AppContext';
import { useFontSize } from '../../utils/useFontSize';
import { useLocale } from '../../utils/useLocale';

export default function AIBlock({ block, wrappedContent, wrappedImages, onUpdate, onDismiss }) {
  const { state, dispatch } = useApp();
  const { t } = useLocale();
  const d = (useFontSize() - 1) * 2;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showDismissMenu, setShowDismissMenu] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const providerId = AI_PROVIDERS[block.provider] ? block.provider : 'gemini';
  const provider = AI_PROVIDERS[providerId] || AI_PROVIDERS.gemini;
  const enabledProviders = getEnabledProviders();
  const messages = block.messages || [];
  const hasWrapped = !!(wrappedContent || (wrappedImages && wrappedImages.length > 0));

  // Get the last AI response text
  const lastAiResponse = [...messages].reverse().find((m) => m.role === 'assistant')?.content || '';

  const LANGUAGES = [
    { label: '🇹🇭 ไทย', code: 'ไทย' },
    { label: '🇬🇧 อังกฤษ', code: 'อังกฤษ' },
    { label: '🇨🇳 จีน', code: 'จีน' },
    { label: '🇯🇵 ญี่ปุ่น', code: 'ญี่ปุ่น' },
    { label: '🇰🇷 เกาหลี', code: 'เกาหลี' },
    { label: '🇻🇳 เวียดนาม', code: 'เวียดนาม' },
    { label: '🇫🇷 ฝรั่งเศส', code: 'ฝรั่งเศส' },
    { label: '🇪🇸 สเปน', code: 'สเปน' },
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

  const handleSend = async (text, mode, silent) => {
    if (!text?.trim()) return;
    const newMsg = { role: 'user', content: text.trim() };
    const updatedMsgs = [...messages, newMsg];
    if (!silent) onUpdate({ ...block, messages: updatedMsgs });
    setInput('');
    setLoading(true);

    // Build context for inquiry/check modes
    let extraContext = null;
    if (mode === 'inquiry' || mode === 'check') {
      const noteSummaries = state.notes.map((n) =>
        `[${n.title || 'Untitled'}]: ${(n.content || '').slice(0, 200)}`
      ).join('\n');
      const todoSummaries = state.todos.map((t) =>
        `[${t.done ? '✓' : '○'}] ${t.title}${t.dueDate ? ` (${t.dueDate})` : ''}${t.note ? ` — ${t.note}` : ''}`
      ).join('\n');
      extraContext = { notes: noteSummaries, todos: todoSummaries, mode };
    }

    try {
      const aiResponse = await callAI({
        provider: providerId,
        messages: updatedMsgs,
        wrappedContent,
        wrappedImages,
        settings: state.aiSettings,
        extraContext,
      });
      onUpdate({
        ...block,
        messages: silent
          ? [...messages, { role: 'assistant', content: aiResponse }]
          : [...updatedMsgs, { role: 'assistant', content: aiResponse }],
      });
    } catch (err) {
      onUpdate({
        ...block,
        messages: silent
          ? [...messages, { role: 'assistant', content: `⚠️ Error: ${err.message}` }]
          : [...updatedMsgs, { role: 'assistant', content: `⚠️ Error: ${err.message}` }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input, block.activeMode || null);
    }
  };

  return (
    <div style={{ ...styles.container, borderColor: provider.color + '40' }}>
      {/* Header with provider selector */}
      <div style={styles.header}>
        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.badge, fontSize: 12 + d, background: provider.color + '20', color: provider.color }}
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
                  <span style={{ color: p.color, fontSize: 13 + d }}>{p.icon}</span>
                  <span style={{ fontSize: 13 + d }}>{p.label}</span>
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
        <span style={{ ...styles.msgCount, fontSize: 11 + d }}>{messages.length} {t('ai.messages')}</span>
        <div style={{ position: 'relative' }}>
          <button style={{ ...styles.dismissBtn, fontSize: 12 + d }} onClick={() => {
            if (lastAiResponse) {
              setShowDismissMenu(!showDismissMenu);
            } else {
              onDismiss?.(block);
            }
          }}>
            {t('ai.dismiss')}
          </button>
          {showDismissMenu && (
            <>
              <div style={styles.backdrop} onClick={() => setShowDismissMenu(false)} />
              <div style={styles.dismissMenu}>
                <button
                  style={styles.dismissOption}
                  onClick={() => { onDismiss?.(block, 'append'); setShowDismissMenu(false); }}
                >
                  <span style={{ fontSize: 13 + d }}>{t('ai.appendAnswer')}</span>
                </button>
                <button
                  style={styles.dismissOption}
                  onClick={() => { onDismiss?.(block, 'replace'); setShowDismissMenu(false); }}
                >
                  <span style={{ fontSize: 13 + d }}>{t('ai.replaceAnswer')}</span>
                </button>
                <button
                  style={{ ...styles.dismissOption, color: C.muted }}
                  onClick={() => { onDismiss?.(block); setShowDismissMenu(false); }}
                >
                  <span style={{ fontSize: 13 + d }}>{t('ai.closeDiscard')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Wrapped content */}
      {(wrappedContent || (wrappedImages && wrappedImages.length > 0)) && (
        <div style={styles.wrapped}>
          <div style={{ ...styles.wrappedLabel, fontSize: 11 + d }}>📎 {wrappedImages?.length ? t('ai.wrappedImages') : t('ai.wrappedText')}</div>
          {wrappedContent && <p style={{ ...styles.wrappedText, fontSize: 13 + d }}>{wrappedContent}</p>}
          {wrappedImages && wrappedImages.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {wrappedImages.map((img, i) => (
                <img key={i} src={img} alt="" style={{ maxWidth: 80, maxHeight: 80, borderRadius: 6, border: `1px solid ${C.border}` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.msg,
              fontSize: 13 + d,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? C.amberLight : '#f5f5f4',
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div style={{ ...styles.msg, fontSize: 13 + d, background: '#f5f5f4' }}>{t('ai.thinking')}</div>}
      </div>

      {/* Quick actions */}
      <div style={styles.quickActions}>
        <button
          style={{ ...styles.quickBtn, fontSize: 12 + d }}
          onClick={() => handleSend(
            hasWrapped
              ? 'สรุปข้อความนี้ให้กระชับ และตรวจสอบความถูกต้องของภาษา'
              : 'สรุปเนื้อหาทั้งหมดให้กระชับ',
            null, true
          )}
          disabled={loading}
        >
          {t('ai.summarize')}
        </button>
        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.quickBtn, fontSize: 12 + d }}
            onClick={() => setShowLangPicker(!showLangPicker)}
            disabled={loading}
          >
            {t('ai.translate')}
          </button>
          {showLangPicker && (
            <>
              <div style={styles.backdrop} onClick={() => setShowLangPicker(false)} />
              <div style={styles.langPicker}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    style={{ ...styles.langOption, fontSize: 13 + d }}
                    onClick={() => {
                      setShowLangPicker(false);
                      handleSend(`แปลเป็นภาษา${lang.code} แปลเฉยๆ ไม่ต้องอธิบายเพิ่ม ไม่ต้องยกตัวอย่าง ให้ผลลัพธ์เป็นคำแปลอย่างเดียว รักษารูปแบบการจัดย่อหน้าและเครื่องหมายวรรคตอนให้ถูกต้อง`, null, true);
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          style={{ ...styles.quickBtn, fontSize: 12 + d }}
          onClick={() => {
            const query = wrappedContent || (wrappedImages?.length ? 'วิเคราะห์รูปภาพนี้' : '');
            if (query) {
              handleSend(query, 'inquiry', true);
            } else {
              onUpdate({ ...block, activeMode: 'inquiry' });
            }
          }}
          disabled={loading}
        >
          {t('ai.inquire')}
        </button>
      </div>

      {/* Mode indicator */}
      {block.activeMode && (
        <div style={{ ...styles.modeIndicator, fontSize: 12 + d }}>
          <span>{t('ai.inquiryMode')}</span>
          <span style={{ fontSize: 11 + d, color: C.muted }}>
            {t('ai.inquiryDesc')}
          </span>
          <button style={styles.modeCancelBtn} onClick={() => onUpdate({ ...block, activeMode: null })}>✕</button>
        </div>
      )}

      {/* Sign in prompt or Input */}
      {needsAuth ? (
        <div style={styles.signInPrompt}>
          <p style={{ ...styles.signInText, fontSize: 13 + d }}>
            {t('ai.signInPrompt')} {provider.label}
          </p>
          <button
            style={{ ...styles.signInBtn, fontSize: 13 + d, background: provider.color }}
            onClick={handleSignIn}
            disabled={loading}
          >
            {loading ? t('ai.connecting') : `${t('ai.signInBtn')} ${provider.oauthProvider === 'google' ? 'Google' : provider.label}`}
          </button>
        </div>
      ) : (
        <div style={styles.inputRow}>
          <textarea
            style={{ ...styles.input, fontSize: 13 + d }}
            placeholder={lastAiResponse && hasWrapped ? t('ai.placeholderMore') : t('ai.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus={false}
            rows={1}
          />
          <button
            style={{ ...styles.sendBtn, background: provider.color }}
            onClick={() => handleSend(input, block.activeMode || null)}
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
    minHeight: 250,
    maxHeight: 400,
    overflowY: 'auto',
  },
  msg: {
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 10,
    maxWidth: '85%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
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
  langPicker: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 6,
    zIndex: 100,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    width: 260,
  },
  langOption: {
    padding: '7px 10px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: C.font,
    textAlign: 'left',
    whiteSpace: 'nowrap',
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
  modeIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: '#f0fdf4',
    borderRadius: 6,
    margin: '4px 12px',
    fontSize: 12,
    fontFamily: C.font,
  },
  modeCancelBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.muted,
    fontSize: 14,
  },
  backdrop: { position: 'fixed', inset: 0, zIndex: 99 },
  dismissMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    minWidth: 200,
    overflow: 'hidden',
  },
  dismissOption: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: C.font,
    color: C.text,
    textAlign: 'left',
  },
};
