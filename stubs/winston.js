// winston stub to capture logging without side effects
function dummy() { return () => {}; } //placeholder formatter
const format = {
  combine: (...args) => ({ combine: args }),
  timestamp: dummy,
  errors: dummy,
  splat: dummy,
  json: dummy,
  printf: (fn) => fn
};
class File { constructor() {} } //placeholder transport
class Console { constructor() {} } //placeholder transport
module.exports = {
  createLogger: () => ({ error() {}, warn() {}, info() {} }), //return minimal logger object
  format,
  transports: { File, Console }
};
