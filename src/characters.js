export const CHARACTERS = {
  fixer: {
    id: 'fixer',
    name: 'THE FIXER',
    description: 'Street-smart courier. Has connections everywhere. Knows how to move product fast.',
    passive: '+10% payout on transport jobs',
    color: '#ff3366',
    bonus: { transportMultiplier: 1.1 }
  },
  ghost: {
    id: 'ghost',
    name: 'THE GHOST',
    description: 'Silent infiltrator. Leaves no trace. Chases end before they begin.',
    passive: '-20% police chase duration',
    color: '#00f0ff',
    bonus: { chaseTimeMultiplier: 0.8 }
  },
  netrunner: {
    id: 'netrunner',
    name: 'THE NETRUNNER',
    description: 'Digital specialist. Hacks the city grid itself. Unlocks hacking chores.',
    passive: 'Unlocks hacking chores',
    color: '#b44cff',
    bonus: { hackingUnlocked: true }
  }
};

export function selectCharacter(id) {
  const char = CHARACTERS[id];
  localStorage.setItem('selectedCharacter', JSON.stringify(char));
  return char;
}
