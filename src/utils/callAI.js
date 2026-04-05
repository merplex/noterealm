import { AI_PROVIDERS } from '../constants/providers';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Call AI provider through backend proxy
 * Automatically resolves auth based on provider's authType:
 *   'server'  → no client-side credentials needed
 *   'oauth'   → sends OAuth access token from settings
 *   'apikey'  → sends API key from settings
 */
export async function callAI({ provider, messages, wrappedContent, wrappedImages, settings, extraContext, autoAnalyze }) {
  const providerConfig = AI_PROVIDERS[provider];
  if (!providerConfig) throw new Error(`Unknown provider: ${provider}`);

  let systemPrompt;
  if (autoAnalyze && wrappedContent) {
    systemPrompt = `คุณเป็นผู้ช่วย AI สำหรับแอป NoteRealm\n\n` +
      `ข้อความที่ผู้ใช้เลือก:\n${wrappedContent}\n\n` +
      `คำสั่ง: วิเคราะห์ข้อความข้างต้นแล้วทำสิ่งที่เหมาะสมที่สุด:\n` +
      `- ถ้าเป็นคำถาม → ตอบจากความรู้ที่มี\n` +
      `- ถ้าเป็นภาษาต่างประเทศ → แปลเป็นไทย\n` +
      `- ถ้าเป็นข้อความยาว → สรุปให้กระชับ\n` +
      `- ถ้าเป็นข้อความที่มีข้อผิดพลาด → แก้ไขให้ถูกต้อง\n` +
      `- ถ้าเป็นหัวข้อทั่วไป → ให้ข้อมูลที่เป็นประโยชน์จากความรู้ที่มี\n` +
      `ตอบตรงๆ ไม่ต้องบอกว่าทำอะไรไม่ได้ ให้ข้อมูลจากความรู้ที่มีเสมอ`;
  } else if (extraContext?.mode === 'inquiry') {
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
    systemPrompt = `ข้อความที่ผู้ใช้คลุมไว้:\n${wrappedContent}\n\nช่วยตอบเกี่ยวกับข้อความข้างต้น ตอบจากความรู้ที่มี ไม่ต้องบอกว่าทำไม่ได้`;
  } else {
    systemPrompt = 'คุณเป็นผู้ช่วย AI สำหรับแอป NoteRealm ตอบเป็นภาษาไทยหรือตามภาษาที่ผู้ใช้ถาม ตอบจากความรู้ที่มีเสมอ';
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

  // If images are provided, add description to system prompt
  if (wrappedImages && wrappedImages.length > 0) {
    systemPrompt = (systemPrompt || '') + '\n\nผู้ใช้แนบรูปภาพมาด้วย กรุณาวิเคราะห์รูปภาพและตอบ';
  }

  const body = {
    provider,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    systemPrompt,
    images: wrappedImages || undefined,
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
