'use strict';

class MetricsCollector{
  constructor(){this.counters=new Map();this.histograms=new Map();this.gauges=new Map();this.timerIntervals=new Map();}
  
  increment(name,tags={},value=1){const key=this.createKey(name,tags);const current=this.counters.get(key)||0;this.counters.set(key,current+value);}
  
  histogram(name,value,tags={}){const key=this.createKey(name,tags);if(!this.histograms.has(key))this.histograms.set(key,[]);const values=this.histograms.get(key);values.push(value);if(values.length>1000)values.splice(0,500);}
  
  gauge(name,value,tags={}){this.gauges.set(this.createKey(name,tags),value);}
  
  timer(name,fn,tags={}){const start=Date.now();try{return fn();}finally{this.histogram(name,Date.now()-start,tags);}}
  
  async timerAsync(name,fn,tags={}){const start=Date.now();try{return await fn();}finally{this.histogram(name,Date.now()-start,tags);}}
  
  createKey(name,tags){return Object.keys(tags).sort().map(key=>`${key}:${tags[key]}`).join(',')+':'+name;}
  
  getMetrics(){return{counters:Object.fromEntries(this.counters),histograms:Object.fromEntries(this.histograms),gauges:Object.fromEntries(this.gauges)};}
  
  getCounter(name,tags={}){return this.counters.get(this.createKey(name,tags))||0;}
  
  getHistogramStats(name,tags={}){const key=this.createKey(name,tags);const values=this.histograms.get(key)||[];if(values.length===0)return null;values.sort((a,b)=>a-b);return{count:values.length,min:values[0],max:values[values.length-1],mean:values.reduce((a,b)=>a+b,0)/values.length,p50:values[Math.floor(values.length*0.5)],p95:values[Math.floor(values.length*0.95)],p99:values[Math.floor(values.length*0.99)]};}
  
  startPeriodicReporting(intervalMs,reporter){const key='periodic:'+intervalMs;if(this.timerIntervals.has(key))return;const timer=setInterval(()=>reporter(this.getMetrics()),intervalMs).unref();this.timerIntervals.set(key,timer);}
  
  stopPeriodicReporting(intervalMs){const key='periodic:'+intervalMs;const timer=this.timerIntervals.get(key);if(timer){clearInterval(timer);this.timerIntervals.delete(key);}}
   
  cleanup(){this.timerIntervals.forEach(timer=>clearInterval(timer));this.timerIntervals.clear();}
  
  reset(){this.counters.clear();this.histograms.clear();this.gauges.clear();}
}

const globalMetrics=new MetricsCollector();

module.exports={MetricsCollector,metrics:globalMetrics};