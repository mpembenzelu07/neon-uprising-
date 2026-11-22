export class Economy {
  constructor() {
    this.state = JSON.parse(localStorage.getItem('economy')) || {
      soft: 1000,
      hard: 0,
      transactions: []
    };
  }

  earn(amount, source) {
    this.state.soft += amount;
    this.state.transactions.push({ type: 'earn', amount, source, date: Date.now() });
    this.save();
  }

  spend(amount, item) {
    if (this.state.soft < amount) throw new Error('Insufficient Creds');
    this.state.soft -= amount;
    this.state.transactions.push({ type: 'spend', amount, item, date: Date.now() });
    this.save();
  }

  requestWithdrawal(amount) {
    if (this.state.soft < amount) throw new Error('Not enough Creds');
    this.state.transactions.push({ type: 'withdrawal_request', amount, date: Date.now() });
    this.save();
    return {
      status: 'pending',
      message: `Withdrawal request of ${amount} Creds logged. Real payouts arrive when the backend launches.`
    };
  }

  save() {
    localStorage.setItem('economy', JSON.stringify(this.state));
  }
}
