const KEYS = {
  urgentDays:  'nk_alert_urgent_days',
  urgentHours: 'nk_alert_urgent_hours',
  highDays:    'nk_alert_high_days',
  highHours:   'nk_alert_high_hours',
};

// ค่า default: urgent = 0 วัน + 2 ชม. ก่อนถึงกำหนด, high = 1 วัน + 0 ชม. ก่อน
const DEFAULTS = { urgentDays: 0, urgentHours: 2, highDays: 1, highHours: 0 };

export function getAlertSettings() {
  return {
    urgentDays:  parseInt(  localStorage.getItem(KEYS.urgentDays)  ?? DEFAULTS.urgentDays,  10),
    urgentHours: parseFloat( localStorage.getItem(KEYS.urgentHours) ?? DEFAULTS.urgentHours),
    highDays:    parseInt(   localStorage.getItem(KEYS.highDays)    ?? DEFAULTS.highDays,    10),
    highHours:   parseFloat( localStorage.getItem(KEYS.highHours)   ?? DEFAULTS.highHours),
  };
}

export function setAlertSetting(key, value) {
  if (KEYS[key]) localStorage.setItem(KEYS[key], String(value));
}

/** แปลง days+hours → milliseconds */
export function leadTimeMs(days, hours) {
  return (days * 24 * 60 + hours * 60) * 60 * 1000;
}
