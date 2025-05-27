function stubMethod(obj, method, fn) {
  const orig = obj[method]; //(capture original method)
  obj[method] = fn; //(replace with stub)
  return () => { obj[method] = orig; }; //(return restore function)
}

module.exports = stubMethod; //(export stubMethod)
