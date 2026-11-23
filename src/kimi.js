// Safe fallback for when Vite is not building the project
let KIMI_ENDPOINT = '/api/kimi';
try {
  if (import.meta.env && import.meta.env.VITE_KIMI_ENDPOINT) {
    KIMI_ENDPOINT = import.meta.env.VITE_KIMI_ENDPOINT;
  }
} catch (e) {
  // Ignore errors in standard browsers where import.meta.env doesn't exist
}

const LOCAL_TIPS = {
  money: 'Complete transport missions for steady income. Deliveries pay 500-800 Creds each.',
  withdraw: 'Open WALLET (💳 button) and enter an amount. Requests are logged — real payouts arrive once the backend launches.',
  mission: 'Look for glowing cyan markers. Walk close and press E to complete for Creds.',
  car: 'Buy vehicles from the GARAGE shop. Each handles differently — Vortex is nimble, Titan is fast.',
  weapon: 'Open the WEAPON shop to upgrade your loadout. Better guns destroy police cars in fewer shots.',
  police: 'Police chases start after risky missions. Escape in time or lose Creds. The Ghost character has shorter chases.',
  character: 'The Fixer earns more from transport. The Ghost escapes chases faster. The Netrunner unlocks hacks.',
  default: "I'm Kimi, your AI assistant. Ask about money, missions, vehicles, weapons, or police chases."
};

export async function askKimi(question, playerState) {
  try {
    const res = await fetch(KIMI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, playerState })
    });
    if (!res.ok) throw new Error('Proxy unavailable');
    const data = await res.json();
    if (data.reply) return data.reply;
  } catch {
    // Fall through to local tips if the API is not set up
  }
  return getLocalResponse(question);
}

function getLocalResponse(question) {
  const q = question.toLowerCase();
  for (const [key, reply] of Object.entries(LOCAL_TIPS)) {
    if (key !== 'default' && q.includes(key)) return reply;
  }
  if (q.includes('help') || q.includes('start')) {
    return 'Start with transport missions to build Creds. Then buy a vehicle from the GARAGE. Complete heists for big payouts — but expect police heat.';
  }
  return LOCAL_TIPS.default;
}
