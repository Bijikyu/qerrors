// basic test helper replicating qtests.stubMethod functionality
module.exports.stubMethod = function(obj, method, impl) {
  const original = obj[method]; //save existing reference
  obj[method] = impl; //replace method with stub implementation
  return function restore() {
    obj[method] = original; //restore original method
  };
};
