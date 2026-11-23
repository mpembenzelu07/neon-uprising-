export const VEHICLES = {
  vortex: {
    id: 'vortex',
    name: 'VORTEX',
    description: 'Agile street racer. Best handling, nimble corners.',
    price: 0,
    stats: { speed: 38, handling: 1.5, accel: 1.3 },
    color: 0x00f0ff
  },
  titan: {
    id: 'titan',
    name: 'TITAN',
    description: 'Heavy muscle car. Brutal top speed, slower turns.',
    price: 2500,
    stats: { speed: 55, handling: 0.9, accel: 1.6 },
    color: 0xff00a0
  },
  specter: {
    id: 'specter',
    name: 'SPECTER',
    description: 'Experimental stealth prototype. Balanced & silent.',
    price: 5000,
    stats: { speed: 48, handling: 1.25, accel: 1.4 },
    color: 0xb44cff
  }
};

export const UPGRADES = {
  engine:    { id: 'engine',   name: 'Engine Upgrade',    cost: 1200, desc: '+8 top speed' },
  handling:  { id: 'handling', name: 'Suspension Tuning', cost: 800,  desc: '+0.2 handling' },
  paint:     { id: 'paint',    name: 'Custom Neon Paint', cost: 500,  desc: 'Change vehicle color' }
};

export class Garage {
  constructor() {
    this.state = JSON.parse(localStorage.getItem('garage')) || {
      owned: ['vortex'],
      current: 'vortex',
      upgrades: {}
    };
  }
  owns(id) { return this.state.owned.includes(id); }
  buy(id) {
    if (this.owns(id)) return false;
    this.state.owned.push(id);
    this.state.current = id;
    this.save();
    return true;
  }
  setCurrent(id) {
    if (this.owns(id)) { this.state.current = id; this.save(); }
  }
  upgrade(vehicleId, upgradeId) {
    const key = `${vehicleId}.${upgradeId}`;
    this.state.upgrades[key] = (this.state.upgrades[key] || 0) + 1;
    this.save();
  }
  hasUpgrade(vehicleId, upgradeId) {
    return !!this.state.upgrades[`${vehicleId}.${upgradeId}`];
  }
  getStats(vehicleId) {
    const base = { ...VEHICLES[vehicleId].stats };
    if (this.hasUpgrade(vehicleId, 'engine'))   base.speed    += 8;
    if (this.hasUpgrade(vehicleId, 'handling')) base.handling += 0.2;
    return base;
  }
  save() { localStorage.setItem('garage', JSON.stringify(this.state)); }
}
