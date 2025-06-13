// lightweight concurrency limiter mimicking the p-limit API
module.exports = function(limit){
  let active=0; //current running count
  const queue=[]; //queued functions waiting to run
  const next=()=>{
    if(active>=limit||queue.length===0) return; //respect concurrency and queue length
    const {fn,resolve,reject}=queue.shift();
    active++; //increase active count for concurrency limit
    Promise.resolve().then(fn).then((val)=>{ active--; resolve(val); next(); }).catch((err)=>{ active--; reject(err); next(); });
  };
  const limiter=(fn)=>{ //returned limit function
    return new Promise((resolve,reject)=>{ queue.push({fn,resolve,reject}); next(); });
  };
  Object.defineProperties(limiter,{ activeCount:{get:()=>active}, pendingCount:{get:()=>queue.length} }); //expose counts like real p-limit
  return limiter; //return throttle function
};

