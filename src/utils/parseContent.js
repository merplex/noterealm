/**
 * Parse note content syntax into renderable blocks
 * Supports: [CODE:lang], [ACCORDION:title], [AI_BLOCK:uuid], [[noteId:Title]],
 *           **bold**, *italic*, ~~strike~~, `code`, [c:#hex]text[/c],
 *           [ ] checklist, [x] checked, - bullet
 */

export function parseBlocks(content) {
  if (!content) return [];

  const blocks = [];
  const blockRegex = /\[(CODE|ACCORDION|AI_BLOCK)(?::([^\]]*))?\]([\s\S]*?)\[\/\1\]|\[AI_BLOCK:([^\]]+)\]/g;

  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    // Text before this block
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    if (match[4]) {
      // [AI_BLOCK:uuid] (self-closing)
      blocks.push({ type: 'ai_block', id: match[4] });
    } else {
      blocks.push({
        type: match[1].toLowerCase(),
        param: match[2] || '',
        content: match[3] || '',
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return blocks;
}

/**
 * Parse inline formatting into segments
 */
export function parseInline(text) {
  if (!text) return [{ type: 'text', content: '' }];

  const segments = [];
  const inlineRegex =
    /\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|\[c:(#[0-9a-fA-F]{3,8})\](.+?)\[\/c\]|\[\[([^:]+):([^\]]+)\]\]/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) segments.push({ type: 'bold', content: match[1] });
    else if (match[2]) segments.push({ type: 'italic', content: match[2] });
    else if (match[3]) segments.push({ type: 'strike', content: match[3] });
    else if (match[4]) segments.push({ type: 'code', content: match[4] });
    else if (match[5]) segments.push({ type: 'color', color: match[5], content: match[6] });
    else if (match[7]) segments.push({ type: 'ref', noteId: match[7], title: match[8] });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Parse lines for checklists and bullets
 */
export function parseLines(text) {
  return text.split('\n').map((line) => {
    if (/^\[x\]\s/.test(line)) return { type: 'checked', content: line.slice(4) };
    if (/^\[ \]\s/.test(line)) return { type: 'unchecked', content: line.slice(4) };
    if (/^[-*+]\s/.test(line)) return { type: 'bullet', content: line.slice(2) };
    return { type: 'line', content: line };
  });
}
