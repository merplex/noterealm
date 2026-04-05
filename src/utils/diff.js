/**
 * Simple word-level diff between two strings.
 * Returns array of { type: 'same'|'add'|'del', text: string }
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
  const result = [];
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
  for (const item of stack) {
    if (result.length > 0 && result[result.length - 1].type === item.type) {
      result[result.length - 1].text += item.text;
    } else {
      result.push({ ...item });
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
 * Strip HTML tags to get plain text for diff comparison
 */
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
