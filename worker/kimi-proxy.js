export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    try {
      const { question, playerState } = await request.json();
      const system = `You are Kimi, the AI assistant inside the game Neon Uprising.
Player: ${playerState?.character || 'unknown'}.
Creds: ${playerState?.credits || 0}.
Missions completed: ${playerState?.missions || 0}.
Reply in 1-3 short sentences. Be practical and helpful with game tips.`;

      const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.KIMI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'moonshot-v1-8k',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: question }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "I couldn't process that. Try again.";
      return new Response(JSON.stringify({ reply }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
