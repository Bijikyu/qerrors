class LRU {
  constructor(opts = {}) {
    this.max = opts.max ?? Infinity; //limit of entries
    this.ttl = opts.ttl ?? 0; //time to live in ms
    this.store = new Map(); //internal storage Map
  }
  get size() { return this.store.size; }
  get(key) { //retrieve value or undefined
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.ttl && Date.now() - entry.ts > this.ttl) { this.store.delete(key); return undefined; }
    this.store.delete(key); this.store.set(key, entry); //move to newest
    return entry.val;
  }
  set(key, val) { //insert value and enforce size limit
    this.store.delete(key);
    this.store.set(key, { val, ts: Date.now() });
    if (this.store.size > this.max) { const first = this.store.keys().next().value; this.store.delete(first); }
  }
  has(key) { return this.get(key) !== undefined; }
  delete(key) { return this.store.delete(key); }
  clear() { this.store.clear(); }
  purgeStale() { //remove expired entries
    if (!this.ttl) return; const now = Date.now();
    for (const [k, e] of this.store) { if (now - e.ts > this.ttl) this.store.delete(k); }
  }
}
module.exports = LRU;
