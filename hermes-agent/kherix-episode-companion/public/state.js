const TERMINAL = new Set(['completed', 'error']);
export class Outbox {
  constructor(storage, request, makeId = () => crypto.randomUUID()) {
    this.storage = storage; this.request = request; this.makeId = makeId;
    try { this.items = JSON.parse(storage.getItem('kherix.outbox') || '[]'); } catch { this.items = []; }
    if (!Array.isArray(this.items)) this.items = [];
    this.items = this.items.filter(item => item && typeof item.clientId === 'string' && typeof item.text === 'string');
  }
  save() { this.storage.setItem('kherix.outbox', JSON.stringify(this.items)); }
  async submit(text) {
    const earlier = this.items.find(item => item.text === text && !TERMINAL.has(item.state));
    if (earlier) return earlier;
    const item = { clientId: this.makeId(), text, state: 'sending', createdAt: new Date().toISOString() };
    this.items.push(item); this.save(); // If local persistence fails, do not send.
    return this.forward(item);
  }
  async forward(item) {
    try {
      const { receipt } = await this.request('/api/messages', { text: item.text, clientId: item.clientId });
      Object.assign(item, receipt);
    } catch { item.state = 'checking_delivery'; item.error = 'Delivery is uncertain. Check the receipt; no automatic resend.'; }
    this.save(); return item;
  }
  async retry(id) {
    const item = this.items.find(item => item.clientId === id);
    if (!item || item.state !== 'not_found') return item;
    item.state = 'sending'; this.save(); return this.forward(item);
  }
  async refresh() {
    for (const item of this.items.filter(item => !TERMINAL.has(item.state))) {
      try {
        const { receipt } = await this.request(`/api/receipts/${encodeURIComponent(item.clientId)}`);
        Object.assign(item, receipt);
      } catch (error) {
        if (error.status === 404) { item.state = 'not_found'; item.error = 'No receipt found. Only an explicit retry will send this same ID again.'; }
        else throw error;
      }
    }
    this.save();
  }
}
