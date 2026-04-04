const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Call AI provider through backend proxy
 */
export async function callAI({ provider, messages, wrappedContent, settings }) {
  const systemPrompt = wrappedContent
    ? `ข้อความที่ผู้ใช้คลุมไว้:\n${wrappedContent}\n\nช่วยตอบเกี่ยวกับข้อความข้างต้น`
    : 'คุณเป็นผู้ช่วย AI สำหรับแอป NoteKeep ตอบเป็นภาษาไทยหรือตามภาษาที่ผู้ใช้ถาม';

  const body = {
    provider,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    systemPrompt,
    apiKey: settings?.[`${provider}Key`],
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
