import { AI_PROVIDERS } from '../constants/providers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Call AI provider through backend proxy
 * Automatically resolves auth based on provider's authType:
 *   'server'  → no client-side credentials needed
 *   'oauth'   → sends OAuth access token from settings
 *   'apikey'  → sends API key from settings
 */
export async function callAI({ provider, messages, wrappedContent, settings }) {
  const providerConfig = AI_PROVIDERS[provider];
  if (!providerConfig) throw new Error(`Unknown provider: ${provider}`);

  const systemPrompt = wrappedContent
    ? `ข้อความที่ผู้ใช้คลุมไว้:\n${wrappedContent}\n\nช่วยตอบเกี่ยวกับข้อความข้างต้น`
    : 'คุณเป็นผู้ช่วย AI สำหรับแอป NoteKeep ตอบเป็นภาษาไทยหรือตามภาษาที่ผู้ใช้ถาม';

  // Resolve credentials based on authType
  const auth = {};
  if (providerConfig.authType === 'oauth') {
    const token = settings?.[`${provider}Token`];
    if (!token) throw new Error(`กรุณา Sign in กับ ${providerConfig.label} ก่อน`);
    auth.accessToken = token;
  } else if (providerConfig.authType === 'apikey') {
    const key = settings?.[`${provider}Key`];
    if (!key) throw new Error(`กรุณาใส่ API Key ของ ${providerConfig.label}`);
    auth.apiKey = key;
  }
  // authType === 'server' → no client credentials

  const body = {
    provider,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    systemPrompt,
    ...auth,
  };

  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI request failed (${res.status})`);
  }

  const data = await res.json();
  return data.content || data.message || '';
}
