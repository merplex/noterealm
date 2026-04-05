/**
 * Find semantically related notes using keyword overlap scoring
 */

function extractKeywords(text) {
  if (!text) return [];
  // Remove inline images (base64 data), accordions, block syntax
  const cleaned = text
    .replace(/<span[^>]*inline-img-wrap[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<div[^>]*inline-accordion[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/data:[^"'\s]+/g, '')
    .replace(/\[(CODE|ACCORDION|AI_BLOCK)[^\]]*\][\s\S]*?\[\/\1\]/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '')
    .replace(/[*~`\[\]#]/g, '')
    .toLowerCase();

  // Split into words, filter short/common words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'and', 'or', 'but', 'not', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'this', 'that', 'it', 'as',
    'ที่', 'เป็น', 'และ', 'ใน', 'จะ', 'ได้', 'มี', 'ไม่',
    'ว่า', 'ของ', 'ให้', 'กับ', 'จาก', 'แต่', 'ก็', 'อยู่',
  ]);

  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

function overlapScore(wordsA, wordsB) {
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setB = new Set(wordsB);
  const matches = wordsA.filter((w) => setB.has(w)).length;
  return matches / Math.max(wordsA.length, wordsB.length);
}

export function findSemanticRelates(targetNote, allNotes, limit = 3) {
  const targetWords = extractKeywords(
    (targetNote.title || '') + ' ' + (targetNote.content || '')
  );

  const scored = allNotes
    .filter((n) => n.id !== targetNote.id)
    .map((n) => {
      const words = extractKeywords((n.title || '') + ' ' + (n.content || ''));
      return { ...n, score: overlapScore(targetWords, words) };
    })
    .filter((n) => n.score > 0.05)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
