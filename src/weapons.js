export const WEAPONS = {
  fists:  { id: 'fists',  name: 'Fists',         damage: 5,  range: 2,  price: 0,    auto: false },
  pistol: { id: 'pistol', name: 'Neon Pistol',   damage: 15, range: 25, price: 400,  auto: false },
  smg:    { id: 'smg',    name: 'SMG-9',         damage: 10, range: 20, price: 1200, auto: true  },
  rifle:  { id: 'rifle',  name: 'Pulse Rifle',   damage: 25, range: 40, price: 3000, auto: false }
};

export class Arsenal {
  constructor() {
    this.state = JSON.parse(localStorage.getItem('arsenal')) || {
      owned: ['fists'],
      equipped: 'fists'
    };
  }
  owns(id) { return this.state.owned.includes(id); }
  buy(id) {
    if (!this.owns(id)) this.state.owned.push(id);
    this.state.equipped = id;
    this.save();
  }
  equip(id) {
    if (this.owns(id)) { this.state.equipped = id; this.save(); }
  }
  current() { return WEAPONS[this.state.equipped]; }
  save() { localStorage.setItem('arsenal', JSON.stringify(this.state)); }
}
