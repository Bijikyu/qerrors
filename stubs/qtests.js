// helper stub for temporarily replacing object methods during tests
module.exports.stubMethod = function(obj, method, impl) {
  const original = obj[method]; //save original function
  obj[method] = impl;
  return function restore() {
    obj[method] = original; //restore original
  };
};
