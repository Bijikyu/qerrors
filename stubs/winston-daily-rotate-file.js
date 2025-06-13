// stub for winston-daily-rotate-file used to track options passed in tests
class DailyRotateFile {
  constructor(opts) {
    this.options = opts; //expose options like real module for tests
    if (!global.DailyRotateFileCalls) global.DailyRotateFileCalls = []; //ensure global storage
    global.DailyRotateFileCalls.push(opts); //record options globally
    DailyRotateFile.calls.push(opts); //record constructor usage on class
  }
}
DailyRotateFile.calls = []; //track constructor calls for tests
module.exports = DailyRotateFile;
