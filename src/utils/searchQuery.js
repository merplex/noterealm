/**
 * Parse search query with AND/OR logic:
 *   - space → AND
 *   - "and" / "และ" → AND
 *   - "or"  / "หรือ" → OR
 *
 * Example:
 *   "react hooks"         → [[react, hooks]]           (AND)
 *   "react and hooks"     → [[react, hooks]]           (AND)
 *   "react or vue"        → [[react], [vue]]           (OR)
 *   "react hooks or vue"  → [[react, hooks], [vue]]    (react AND hooks) OR vue
 */
export function parseQuery(text) {
  if (!text?.trim()) return [];
  // Split into OR-groups first
  const orGroups = text.trim().split(/\s+(?:or|หรือ)\s+/i);
  return orGroups.map((group) =>
    group
      .trim()
      .split(/\s+(?:and|และ)\s+|\s+/i)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Test a string against a parsed query (array of AND-groups).
 * Returns true if any AND-group fully matches (all terms present).
 */
export function matchQuery(str, parsedQuery) {
  if (!parsedQuery.length) return true;
  const lower = (str || '').toLowerCase();
  return parsedQuery.some((andTerms) => andTerms.every((term) => lower.includes(term)));
}
