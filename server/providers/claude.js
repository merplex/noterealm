import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude provider handler
 * authType: 'server' — uses server-side ANTHROPIC_API_KEY
 * Supports web search via Claude's built-in web_search tool
 */
export default async function claude({ messages, systemPrompt, images }) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Ensure messages starts with user role and is not empty
  let cleanMsgs = (messages || []).map((m) => ({ role: m.role, content: m.content }));
  // Remove leading assistant messages (from auto-analyze)
  while (cleanMsgs.length > 0 && cleanMsgs[0].role !== 'user') {
    cleanMsgs.shift();
  }
  if (cleanMsgs.length === 0) {
    cleanMsgs = [{ role: 'user', content: systemPrompt || 'สวัสดี' }];
  }

  // If images are provided, attach them to the first user message
  if (images && images.length > 0 && cleanMsgs.length > 0) {
    const firstUserIdx = cleanMsgs.findIndex((m) => m.role === 'user');
    if (firstUserIdx >= 0) {
      const textContent = cleanMsgs[firstUserIdx].content;
      const contentParts = [];
      for (const img of images) {
        // Handle base64 data URLs
        const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          contentParts.push({
            type: 'image',
            source: { type: 'base64', media_type: match[1], data: match[2] },
          });
        }
      }
      contentParts.push({ type: 'text', text: textContent || 'วิเคราะห์รูปภาพนี้' });
      cleanMsgs[firstUserIdx].content = contentParts;
    }
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt || '',
    messages: cleanMsgs,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
  });

  // Extract text from response, including after tool use
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
