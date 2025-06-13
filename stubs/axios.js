// minimal axios stub used in tests to avoid network calls
function stubPost() { //default unmocked post throws to catch stray calls
  throw new Error('axios.post not stubbed'); //fail fast if axios.post used without stub
}

module.exports = {
  post: async () => { stubPost(); }, //provide top-level post like real axios
  create: (opts = {}) => ({ post: async () => { stubPost(); }, defaults: opts }) //return axios-like instance with defaults
};
