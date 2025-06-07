function stubPost() { //default unmocked post throws to catch stray calls
  throw new Error('axios.post not stubbed');
}

module.exports = {
  post: async () => { stubPost(); },
  create: (opts = {}) => ({ post: async () => { stubPost(); }, defaults: opts }) //mimic axios.create returning instance with post and defaults
};
