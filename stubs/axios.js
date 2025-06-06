function stubPost() { //default unmocked post throws to catch stray calls
  throw new Error('axios.post not stubbed');
}

module.exports = {
  post: async () => { stubPost(); },
  create: () => ({ post: async () => { stubPost(); } }) //mimic axios.create returning instance with post
};
