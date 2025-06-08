const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub helper

function loadQerrors() {
  delete require.cache[require.resolve('../lib/qerrors')];
  return require('../lib/qerrors');
}

test('warn when limits exceed safe threshold', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //backup concurrency
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup queue limit
  process.env.QERRORS_CONCURRENCY = '2000'; //excessive concurrency
  process.env.QERRORS_QUEUE_LIMIT = '2000'; //excessive queue
  const logger = await require('../lib/logger'); //logger instance
  let warned = false; //track warn calls
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => { warned = true; });
  try {
    loadQerrors(); //module initialization triggers warning
    await Promise.resolve(); //allow async logger call
  } finally {
    restoreWarn(); //restore logger.warn
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    delete require.cache[require.resolve('../lib/qerrors')]; //reset module
    require('../lib/qerrors'); //reload defaults
  }
  assert.equal(warned, true); //expect warning emitted
});

test('limits below custom threshold do not warn', async () => { //verify config clamp usage
  const origConc = process.env.QERRORS_CONCURRENCY; //backup concurrency value
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup queue value
  const origSafe = process.env.QERRORS_SAFE_THRESHOLD; //backup safe threshold
  process.env.QERRORS_CONCURRENCY = '1500'; //value above default threshold
  process.env.QERRORS_QUEUE_LIMIT = '1500'; //value above default threshold
  process.env.QERRORS_SAFE_THRESHOLD = '2000'; //raise threshold so no warn expected
  const logger = await require('../lib/logger'); //logger instance
  let warned = false; //track warn state
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => { warned = true; });
  try {
    loadQerrors(); //reload with custom env values
    await Promise.resolve(); //allow async logger call
  } finally {
    restoreWarn(); //restore logger.warn method
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    if (origSafe === undefined) { delete process.env.QERRORS_SAFE_THRESHOLD; } else { process.env.QERRORS_SAFE_THRESHOLD = origSafe; }
    delete require.cache[require.resolve('../lib/qerrors')]; //reset cached module
    require('../lib/qerrors'); //restore defaults
  }
  assert.equal(warned, false); //expect no warning when within custom threshold
});
