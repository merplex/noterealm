import { getUserId } from './syncService';

const BASE = import.meta.env.VITE_API_URL ?? '';

// localStorage keys ที่ต้อง sync กับ server
const SETTINGS_KEYS = [
  'nk_alert_urgent_days',
  'nk_alert_urgent_hours',
  'nk_alert_high_days',
  'nk_alert_high_hours',
  'nk_sync_auto',
  'nk_font_size_level',
  'nk_locale',
];

// events ที่ต้อง dispatch เมื่อ apply settings มาจาก server
const KEY_EVENTS = {
  nk_font_size_level: 'font-size-changed',
  nk_locale:          'locale-changed',
  nk_alert_urgent_days:  'alert-settings-changed',
  nk_alert_urgent_hours: 'alert-settings-changed',
  nk_alert_high_days:    'alert-settings-changed',
  nk_alert_high_hours:   'alert-settings-changed',
};

/** รวบรวม settings ทั้งหมดจาก localStorage */
function collectSettings() {
  const obj = {};
  for (const key of SETTINGS_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) obj[key] = val;
  }
  return obj;
}

/** เขียน settings object ลง localStorage แล้ว dispatch events ที่เกี่ยวข้อง */
function applySettings(obj) {
  if (!obj || typeof obj !== 'object') return;
  const fired = new Set();
  for (const key of SETTINGS_KEYS) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const current = localStorage.getItem(key);
      if (current !== String(obj[key])) {
        localStorage.setItem(key, String(obj[key]));
        const evt = KEY_EVENTS[key];
        if (evt && !fired.has(evt)) {
          window.dispatchEvent(new Event(evt));
          fired.add(evt);
        }
      }
    }
  }
}

/** Push settings ขึ้น server */
export async function pushSettings() {
  const userId = getUserId();
  if (!userId) return;
  try {
    await fetch(`${BASE}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify(collectSettings()),
    });
  } catch (err) {
    console.warn('[settingsSync] push failed:', err.message);
  }
}

/** Pull settings จาก server แล้ว apply ลง localStorage */
export async function pullSettings() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const res = await fetch(`${BASE}/api/settings`, {
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) return;
    const data = await res.json();
    applySettings(data);
  } catch (err) {
    console.warn('[settingsSync] pull failed:', err.message);
  }
}
