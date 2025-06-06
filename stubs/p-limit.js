module.exports = function(limit){
  let active=0;
  const queue=[];
  const next=()=>{
    if(active>=limit||queue.length===0) return;
    const {fn,resolve,reject}=queue.shift();
    active++; //increase active count for concurrency limit
    Promise.resolve().then(fn).then((val)=>{ active--; resolve(val); next(); }).catch((err)=>{ active--; reject(err); next(); });
  };
  return (fn)=>{
    return new Promise((resolve,reject)=>{ queue.push({fn,resolve,reject}); next(); });
  };
};

