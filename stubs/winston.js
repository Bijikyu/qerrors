// winston stub providing minimal logging API for tests
function dummy() { return () => {}; } //placeholder format functions
const format = {
  combine: (...args) => ({ combine: args }), //capture combine arguments
  timestamp: dummy,
  errors: dummy,
  splat: dummy,
  json: dummy,
  printf: (fn) => fn
};
class File { constructor() {} } //stub transport
class Console { constructor() {} } //stub transport
module.exports = {
  createLogger: () => ({ error() {}, warn() {}, info() {} }), //fake logger instance
  format,
  transports: { File, Console } //export stub transports
};
