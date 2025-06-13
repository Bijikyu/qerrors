// stub of winston-daily-rotate-file to avoid file system operations in tests
class DailyRotateFile {
  constructor(opts) {
    this.options = opts; //expose options like real module for tests
    // Use global tracking to ensure all instances are captured
    if (!global.DailyRotateFileCalls) global.DailyRotateFileCalls = [];
    global.DailyRotateFileCalls.push(opts);
    // Also track on class for backward compatibility
    DailyRotateFile.calls.push(opts); //record constructor usage
  }
}
DailyRotateFile.calls = []; //track constructor calls for tests
module.exports = DailyRotateFile; //export stub constructor
