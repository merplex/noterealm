import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude provider handler
 * authType: 'server' — uses server-side ANTHROPIC_API_KEY
 * Supports web search via Claude's built-in web_search tool
 */
export default async function claude({ messages, systemPrompt }) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt || '',
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
  });

  // Extract text from response, including after tool use
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
