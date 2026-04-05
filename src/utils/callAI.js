import { AI_PROVIDERS } from '../constants/providers';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Call AI provider through backend proxy
 * Automatically resolves auth based on provider's authType:
 *   'server'  → no client-side credentials needed
 *   'oauth'   → sends OAuth access token from settings
 *   'apikey'  → sends API key from settings
 */
export async function callAI({ provider, messages, wrappedContent, settings, extraContext }) {
  const providerConfig = AI_PROVIDERS[provider];
  if (!providerConfig) throw new Error(`Unknown provider: ${provider}`);

  let systemPrompt;
  if (extraContext?.mode === 'inquiry') {
    systemPrompt = `คุณเป็นผู้ช่วย AI สำหรับแอป NoteRealm\n\n` +
      `โน้ตของผู้ใช้:\n${extraContext.notes || '(ไม่มีโน้ต)'}\n\n` +
      `Todo ของผู้ใช้:\n${extraContext.todos || '(ไม่มี todo)'}\n\n` +
      `คำสั่ง: ค้นหาคำตอบจากโน้ตและ todo ของผู้ใช้ก่อน ถ้าพบข้อมูลที่เกี่ยวข้องให้ตอบจากข้อมูลนั้น ถ้าไม่พบให้ตอบจากความรู้ทั่วไป โดยระบุว่าไม่พบในโน้ต` +
      (wrappedContent ? `\n\nข้อความที่คลุมไว้:\n${wrappedContent}` : '');
  } else if (extraContext?.mode === 'check') {
    systemPrompt = `คุณเป็นผู้ช่วย AI สำหรับแอป NoteRealm\n\n` +
      `โน้ตของผู้ใช้:\n${extraContext.notes || '(ไม่มีโน้ต)'}\n\n` +
      `Todo ของผู้ใช้:\n${extraContext.todos || '(ไม่มี todo)'}\n\n` +
      `คำสั่ง: ตรวจสอบข้อมูลจากโน้ต, todo และปฏิทินของผู้ใช้ แล้วตอบคำถาม สรุปสถานะ หรือแจ้งเตือนสิ่งที่เกี่ยวข้อง` +
      (wrappedContent ? `\n\nข้อความที่คลุมไว้:\n${wrappedContent}` : '');
  } else if (wrappedContent) {
    systemPrompt = `ข้อความที่ผู้ใช้คลุมไว้:\n${wrappedContent}\n\nช่วยตอบเกี่ยวกับข้อความข้างต้น`;
  } else {
    systemPrompt = 'คุณเป็นผู้ช่วย AI สำหรับแอป NoteRealm ตอบเป็นภาษาไทยหรือตามภาษาที่ผู้ใช้ถาม';
  }

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
