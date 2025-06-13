// axios stub used in tests to prevent actual HTTP requests
function stubPost() { //default unmocked post throws to catch stray calls
  throw new Error('axios.post not stubbed'); //fail fast if not stubbed
}

module.exports = {
  post: async () => { stubPost(); }, //simulate axios.post for tests
  create: (opts = {}) => ({ post: async () => { stubPost(); }, defaults: opts }) //mimic axios.create returning instance with post and defaults
};
