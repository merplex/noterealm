import { useState, useEffect } from 'react';

const KEY = 'nk_font_size_level';
const EVENT = 'nr-font-size-change';

/** คืน level (1|2|3) — re-render อัตโนมัติเมื่อ setting เปลี่ยน */
export function useFontSize() {
  const [level, setLevel] = useState(() => parseInt(localStorage.getItem(KEY) || '1'));

  useEffect(() => {
    const handler = () => setLevel(parseInt(localStorage.getItem(KEY) || '1'));
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return level; // 1, 2, or 3
}

export function setFontSizeLevel(level) {
  localStorage.setItem(KEY, String(level));
  window.dispatchEvent(new Event(EVENT));
}

export function getFontSizeLevel() {
  return parseInt(localStorage.getItem(KEY) || '1');
}
