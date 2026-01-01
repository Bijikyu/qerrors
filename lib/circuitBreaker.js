/**
 * Simplified Circuit Breaker using opossum directly
 * 
 * Purpose: Production-ready circuit breaker pattern for external service resilience.
 * Uses opossum library directly without unnecessary wrapper complexity.
 * 
 * Features:
 * - Configurable failure thresholds
 * - Automatic state transitions (CLOSED -> OPEN -> HALF_OPEN)
 * - Timeout protection for operations
 * - Detailed metrics collection
 * - Automatic recovery attempts
 * - Event emission for monitoring
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Checking if service recovered
 */
const CircuitBreaker=require('opossum'),qerrors=require('./qerrors');function createCircuitBreaker(operation,serviceName,options={}){if(!options||options.failureThreshold<=0)throw new Error('failureThreshold must be positive');if(options.recoveryTimeoutMs<=0)throw new Error('recoveryTimeoutMs must be positive');const opossumOptions={timeout:options.timeoutMs||10000,errorThreshold:options.failureThreshold,resetTimeout:options.recoveryTimeoutMs,rollingCountTimeout:options.monitoringPeriodMs||60000,rollingCountBuckets:10,cacheEnabled:false,enabled:true};const breaker=new CircuitBreaker(operation,opossumOptions);breaker.on('open',()=>{try{qerrors(null,'circuitBreaker.open',{operation:'circuit_breaker_state_transition',serviceName,fromState:'CLOSED_OR_HALF_OPEN',toState:'OPEN'});}catch(error){console.error('Circuit breaker open logging error:',error.message);}console.log(`[CircuitBreaker] ${serviceName}: transitioning to OPEN`);});breaker.on('halfOpen',()=>{try{qerrors(null,'circuitBreaker.halfOpen',{operation:'circuit_breaker_state_transition',serviceName,fromState:'OPEN',toState:'HALF_OPEN'});}catch(error){console.error('Circuit breaker half-open logging error:',error.message);}console.log(`[CircuitBreaker] ${serviceName}: transitioning to HALF_OPEN`);});breaker.on('close',()=>{try{qerrors(null,'circuitBreaker.close',{operation:'circuit_breaker_state_transition',serviceName,fromState:'OPEN_OR_HALF_OPEN',toState:'CLOSED'});}catch(error){console.error('Circuit breaker close logging error:',error.message);}console.log(`[CircuitBreaker] ${serviceName}: transitioning to CLOSED`);});breaker.on('failure',(result,error)=>{try{qerrors(error,'circuitBreaker.failure',{operation:'circuit_breaker_failure',serviceName,hasResult:!!result,errorMessage:error?.message});}catch(qerror){console.error('qerrors logging failed in circuit breaker failure:',qerror.message);}});return{async execute(...args){try{return await breaker.fire(...args);}catch(error){try{qerrors(error,'circuitBreaker.execute',{operation:'circuit_breaker_execution',serviceName,circuitState:breaker.opened?'OPEN':'CLOSED',hasArgs:args.length>0});}catch(qerror){console.error('qerrors logging failed in circuit breaker execute:',qerror.message);}throw error;}},getState(){if(breaker.opened)return'OPEN';if(breaker.halfOpen)return'HALF_OPEN';return'CLOSED';},getStats(){return breaker.stats;},reset(){breaker.close();},isOpen(){return breaker.opened;},healthCheck(){return{state:this.getState(),isRequestAllowed:!breaker.opened,stats:breaker.stats,serviceName};},getBreaker(){return breaker;}};}class CircuitBreakerWrapper{constructor(operation,serviceName,options){this._breaker=createCircuitBreaker(operation,serviceName,options);this.serviceName=serviceName;this.options=options;}async execute(...args){return this._breaker.execute(...args);}getState(){return this._breaker.getState();}getStats(){return this._breaker.getStats();}reset(){this._breaker.reset();}isOpen(){return this._breaker.isOpen();}healthCheck(){return this._breaker.healthCheck();}}module.exports={createCircuitBreaker,CircuitBreakerWrapper,CircuitBreaker};