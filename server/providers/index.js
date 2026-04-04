/**
 * AI Provider Registry (Backend)
 *
 * เพิ่ม AI ใหม่:
 *   1. สร้างไฟล์ใน server/providers/xxx.js — export default async function
 *   2. import + เพิ่มใน registry ด้านล่าง
 *   3. เพิ่ม entry ใน src/constants/providers.js (frontend)
 *   แค่นั้น — ไม่ต้องแก้ route หรือ AIBlock component
 */

import claude from './claude.js';
import gemini from './gemini.js';

const registry = {
  claude,
  gemini,
  // เพิ่ม AI ใหม่ตรงนี้:
  // mistral: (await import('./mistral.js')).default,
};

export function getProvider(name) {
  const handler = registry[name];
  if (!handler) throw new Error(`Unknown AI provider: ${name}`);
  return handler;
}

export function listProviders() {
  return Object.keys(registry);
}
