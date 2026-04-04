/**
 * AI Provider Registry — Plugin-based architecture
 *
 * เพิ่ม AI ใหม่: แค่เพิ่ม entry ที่นี่ + เพิ่มไฟล์ handler ใน server/providers/
 * ไม่ต้องแก้ AIBlock, callAI, หรือ route เลย
 *
 * authType:
 *   'server'  → key อยู่ฝั่ง server ผู้ใช้ไม่ต้องทำอะไร
 *   'oauth'   → ผู้ใช้กด Sign in (Google, etc.)
 *   'apikey'  → ผู้ใช้กรอก API key เอง (fallback)
 */

export const AI_PROVIDERS = {
  claude: {
    id: 'claude',
    icon: '✦',
    color: '#d97706',
    label: 'Claude',
    authType: 'server',
    enabled: true,
  },
  gemini: {
    id: 'gemini',
    icon: '◈',
    color: '#1a73e8',
    label: 'Gemini',
    authType: 'oauth',
    oauthProvider: 'google',
    enabled: true,
  },
  // เพิ่ม AI ใหม่ตรงนี้:
  // mistral: {
  //   id: 'mistral',
  //   icon: '▣',
  //   color: '#ff7000',
  //   label: 'Mistral',
  //   authType: 'server',
  //   enabled: true,
  // },
};

/** Get only enabled providers */
export function getEnabledProviders() {
  return Object.values(AI_PROVIDERS).filter((p) => p.enabled);
}

/** Check if provider needs user auth action */
export function needsUserAuth(providerId) {
  const p = AI_PROVIDERS[providerId];
  return p?.authType === 'oauth' || p?.authType === 'apikey';
}

// --- Non-AI constants below ---

export const STORAGE_KEYS = {
  notes: 'nk_notes',
  groups: 'nk_groups',
  tags: 'nk_tags',
  todos: 'nk_todos',
  aiSettings: 'nk_ai_settings',
  connections: 'nk_connections',
  activeTab: 'nk_active_tab',
};

export const CONNECTION_TYPES = ['email', 'line', 'telegram', 'wechat'];

export const CONNECTION_ICONS = {
  email: '📧',
  line: '💬',
  wechat: '💚',
  telegram: '🤖',
};
