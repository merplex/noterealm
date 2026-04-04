/**
 * Simple line-based diff between two text strings
 * Returns { added, deleted, edited, changes[] }
 */
export function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');

  const changes = [];
  let added = 0;
  let deleted = 0;
  let edited = 0;

  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined && newLine !== undefined) {
      changes.push({ type: 'add', text: newLine, line: i });
      added++;
    } else if (newLine === undefined && oldLine !== undefined) {
      changes.push({ type: 'del', text: oldLine, line: i });
      deleted++;
    } else if (oldLine !== newLine) {
      changes.push({ type: 'del', text: oldLine, line: i });
      changes.push({ type: 'add', text: newLine, line: i });
      edited++;
    }
  }

  return { added, deleted, edited, changes };
}
