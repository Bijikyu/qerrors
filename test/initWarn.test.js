const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub helper

function loadQerrors() {
  delete require.cache[require.resolve('../lib/qerrors')];
  return require('../lib/qerrors');
}

test('warn when limits exceed safe threshold', () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //backup concurrency
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup queue limit
  process.env.QERRORS_CONCURRENCY = '2000'; //excessive concurrency
  process.env.QERRORS_QUEUE_LIMIT = '2000'; //excessive queue
  const logger = require('../lib/logger'); //logger instance
  let warned = false; //track warn calls
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => { warned = true; });
  try {
    loadQerrors(); //module initialization triggers warning
  } finally {
    restoreWarn(); //restore logger.warn
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    delete require.cache[require.resolve('../lib/qerrors')]; //reset module
    require('../lib/qerrors'); //reload defaults
  }
  assert.equal(warned, true); //expect warning emitted
});
