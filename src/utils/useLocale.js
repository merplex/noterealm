import { useState, useEffect } from 'react';
import th from '../i18n/th';
import en from '../i18n/en';

const LOCALES = { th, en };
const KEY = 'nk_locale';
const EVENT = 'nr-locale-change';

function getLocale() {
  return localStorage.getItem(KEY) || 'th';
}

/** Returns { t, locale } — re-renders when locale changes */
export function useLocale() {
  const [locale, setLoc] = useState(getLocale);

  useEffect(() => {
    const handler = () => setLoc(getLocale());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const t = (key) => {
    const map = LOCALES[locale] || LOCALES.th;
    return key in map ? map[key] : (LOCALES.th[key] ?? key);
  };

  return { t, locale };
}

export function setLocale(locale) {
  localStorage.setItem(KEY, locale);
  window.dispatchEvent(new Event(EVENT));
}

export function getCurrentLocale() {
  return getLocale();
}
