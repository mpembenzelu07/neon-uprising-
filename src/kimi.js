const DEFAULT = "I'm your AI assistant. Try asking about money, missions, characters, or how to withdraw.";

export function getKimiResponse(question, economy, character) {
  const q = question.toLowerCase();

  if (q.includes('money') || q.includes('earn') || q.includes('pesa') || q.includes('creds')) {
    return `You have ${economy.state.soft.toLocaleString()} Creds. Complete transport missions for fast money — ${character.name} gets a bonus on those.`;
  }
  if (q.includes('withdraw') || q.includes('kutoa') || q.includes('cash')) {
    return 'Open the WALLET panel (💳 button) and enter an amount. This logs a withdrawal request — real payouts arrive when we launch the backend.';
  }
  if (q.includes('mission') || q.includes('job') || q.includes('kazi')) {
    return 'Look for glowing cyan markers around the city. Walk near one and press E to complete the mission for Creds.';
  }
  if (q.includes('character') || q.includes('best') || q.includes('who')) {
    return 'Each character has a passive. The Fixer earns +10% on transport. The Ghost has shorter chases. The Netrunner unlocks hacking.';
  }
  if (q.includes('tip') || q.includes('help') || q.includes('start')) {
    return 'Start with transport missions to build up Creds. Avoid the pink heist markers until you have at least 5,000 Creds — but they pay the most.';
  }
  return DEFAULT;
}
