function stubMethod(obj, method, replacement) {
  console.log(`stubMethod is running with ${method}`); //start log
  try {
    const orig = obj[method]; //capture original
    obj[method] = replacement; //replace method
    const restore = () => { obj[method] = orig; }; //create restore function
    console.log(`stubMethod is returning restore`); //return log
    return restore; //return restore
  } catch (error) {
    console.error(`stubMethod encountered ${error.message}`); //error log
    throw error; //rethrow
  }
}

module.exports = stubMethod; //export restore helper
