class DailyRotateFile {
  constructor(opts) {
    this.opts = opts; //store options for test verification
    DailyRotateFile.calls.push(opts); //record constructor usage
  }
}
DailyRotateFile.calls = []; //track constructor calls for tests
module.exports = DailyRotateFile;
