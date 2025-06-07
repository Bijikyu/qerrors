let createdOptions = null; //options passed to createClient
let lastClient = null; //expose most recent client instance for assertions
function createClient(opts = {}) { //mimic redis.createClient
  createdOptions = opts; //store options for test assertions
  lastClient = {
    store: new Map(), //simple in-memory store
    lastSetOpts: null, //capture options from set
    async connect() {}, //no-op async connect
    on() {}, //no-op listener
    async get(key) { return this.store.has(key) ? this.store.get(key) : null; }, //return value or null
    async set(key, val, opts) { this.store.set(key, val); this.lastSetOpts = opts; }, //save value with opts
  };
  return lastClient; //return client instance
}
module.exports = { createClient, createdOptions, get lastClient() { return lastClient; } }; //expose for tests with getter
