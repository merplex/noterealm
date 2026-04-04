export const PROVIDERS = {
  claude: { icon: '✦', color: '#d97706', noKeyNeeded: true, label: 'Claude' },
  gemini: { icon: '◈', color: '#1a73e8', keyRequired: true, label: 'Gemini' },
  chatgpt: { icon: '◉', color: '#10a37f', keyRequired: true, label: 'ChatGPT' },
};

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
