import { Preferences } from '@capacitor/preferences';

const isCapacitor = typeof window !== 'undefined' && window.Capacitor;

export const storage = {
  async get(key) {
    if (isCapacitor) {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  async set(key, value) {
    const json = JSON.stringify(value);
    if (isCapacitor) {
      await Preferences.set({ key, value: json });
    } else {
      localStorage.setItem(key, json);
    }
  },

  async remove(key) {
    if (isCapacitor) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },
};
