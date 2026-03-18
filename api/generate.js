export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { goal, system, mode } = req.body;

  if (!goal || !system) {
    return res.status(400).json({ error: 'Missing goal or system prompt' });
  }

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  // Use fast small model for context questions, full model for prompt generation
  const model = mode === 'questions'
    ? 'llama-3.1-8b-instant'       // ~0.5s — just needs to output JSON questions
    : 'llama-3.3-70b-versatile';   // full quality for the actual prompt

  const maxTokens = mode === 'questions' ? 400 : 1800;

  const userMessage = mode === 'questions'
    ? goal
    : `USER GOAL: "${goal}"\n\nThink through the 5-step process silently, then output ONLY the final prompt. Nothing before it, nothing after it except the TIP line.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_KEY
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
