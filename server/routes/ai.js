import { Router } from 'express';
import Anthropic from 'anthropic';

const router = Router();

router.post('/chat', async (req, res) => {
  const { provider, messages, systemPrompt, apiKey } = req.body;

  try {
    if (provider === 'claude') {
      const client = new Anthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || '',
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');

      return res.json({ content: text });
    }

    if (provider === 'gemini') {
      if (!apiKey) return res.status(400).json({ error: 'Gemini API key required' });

      const geminiMessages = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            contents: geminiMessages,
          }),
        }
      );

      const data = await geminiRes.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.json({ content: text });
    }

    if (provider === 'chatgpt') {
      if (!apiKey) return res.status(400).json({ error: 'OpenAI API key required' });

      const openaiMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ];

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openaiMessages,
        }),
      });

      const data = await openaiRes.json();
      const text = data.choices?.[0]?.message?.content || '';
      return res.json({ content: text });
    }

    res.status(400).json({ error: `Unknown provider: ${provider}` });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
