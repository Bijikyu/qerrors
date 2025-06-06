module.exports.stubMethod = function(obj, method, impl) {
  const original = obj[method];
  obj[method] = impl;
  return function restore() {
    obj[method] = original;
  };
};
