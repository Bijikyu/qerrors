function dummy() { return () => {}; }
const format = {
  combine: (...args) => ({ combine: args }),
  timestamp: dummy,
  errors: dummy,
  splat: dummy,
  json: dummy,
  printf: (fn) => fn
};
class File { constructor() {} }
class Console { constructor() {} }
module.exports = {
  createLogger: () => ({ error() {}, warn() {}, info() {} }),
  format,
  transports: { File, Console }
};
