import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude provider handler
 * authType: 'server' — uses server-side ANTHROPIC_API_KEY
 */
export default async function claude({ messages, systemPrompt }) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt || '',
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
