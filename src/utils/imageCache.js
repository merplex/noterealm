import { db } from '../db/localDb';

// Cache รูปจาก URL ลง IndexedDB (skip data URLs)
export async function cacheImage(url) {
  if (!url || url.startsWith('data:')) return;
  try {
    const existing = await db.imageCache.get(url);
    if (existing) return; // มีแล้ว
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    await db.imageCache.put({ url, blob, size: blob.size, cachedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('[imageCache] cache failed:', url, e.message);
  }
}

// ดึง blob URL จาก cache (คืน null ถ้าไม่มี)
export async function getCachedBlobUrl(url) {
  if (!url || url.startsWith('data:')) return null;
  try {
    const cached = await db.imageCache.get(url);
    if (!cached?.blob) return null;
    return URL.createObjectURL(cached.blob);
  } catch {
    return null;
  }
}

// เคลียร์ cache ทั้งหมด
export async function clearImageCache() {
  await db.imageCache.clear();
}

// ขนาด cache รวม (bytes) + จำนวนรูป
export async function getImageCacheStats() {
  const all = await db.imageCache.toArray();
  const size = all.reduce((s, item) => s + (item.size || 0), 0);
  return { count: all.length, size };
}

// แปลง bytes → ข้อความอ่านง่าย
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
