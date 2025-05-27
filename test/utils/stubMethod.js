function stubMethod(obj, method, mock) {
  const orig = obj[method]; //capture original method for restore
  obj[method] = mock; //apply provided mock
  return () => { obj[method] = orig; }; //return restore function
}

module.exports = stubMethod;
