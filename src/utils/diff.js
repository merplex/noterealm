/**
 * Simple word-level diff between two strings.
 * Returns array of { type: 'same'|'add'|'del'|'mod', text: string, oldText?: string }
 */
export function diffWords(oldStr, newStr) {
  const oldWords = tokenize(oldStr);
  const newWords = tokenize(newStr);

  // LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table (optimized for moderate sizes)
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldWords[i - 1] === newWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to get diff
  let i = m, j = n;
  const stack = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ type: 'same', text: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', text: newWords[j - 1] });
      j--;
    } else {
      stack.push({ type: 'del', text: oldWords[i - 1] });
      i--;
    }
  }
  stack.reverse();

  // Merge consecutive same-type tokens
  const merged = [];
  for (const item of stack) {
    if (merged.length > 0 && merged[merged.length - 1].type === item.type) {
      merged[merged.length - 1].text += item.text;
    } else {
      merged.push({ ...item });
    }
  }

  // Convert adjacent del+add pairs into 'mod' (modified) segments
  const result = [];
  for (let k = 0; k < merged.length; k++) {
    if (merged[k].type === 'del' && k + 1 < merged.length && merged[k + 1].type === 'add') {
      result.push({ type: 'mod', text: merged[k + 1].text, oldText: merged[k].text });
      k++; // skip the add
    } else {
      result.push(merged[k]);
    }
  }

  return result;
}

function tokenize(str) {
  if (!str) return [];
  // Split into words and whitespace, preserving separators
  return str.match(/\S+|\s+/g) || [];
}

/**
 * Strip HTML tags to get plain text for diff comparison.
 * Preserves line breaks from <br>, <div>, <p> tags.
 */
export function stripHtml(html) {
  if (!html) return '';
  let text = html;
  // Convert <br> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Opening block tags represent a new block — add newline before content
  text = text.replace(/<div[^>]*>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '\n');
  // Closing block tags — no additional newline needed
  text = text.replace(/<\/div>/gi, '');
  text = text.replace(/<\/p>/gi, '');
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&quot;/g, '"');
  // Clean up multiple consecutive newlines to max 2
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim leading/trailing newlines
  text = text.replace(/^\n+/, '');
  text = text.replace(/\n+$/, '');
  return text;
}
