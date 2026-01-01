'use strict';
/**
 * Logger module that builds and exports a configured Winston logger along with
 * convenience wrapper functions. The wrappers bind the shared logger instance
 * to the low‑level logging helpers so callers do not need to pass the logger
 * explicitly. This design centralises logger configuration while keeping the
 * public API ergonomic.
 *
 * Rationale:
 * - Exporting the logger directly mirrors typical Winston usage (`require(...).logger`).
 * - Providing bound helper functions avoids repetitive `logger` arguments throughout
 *   the codebase, reducing boilerplate and the chance of using a different logger
 *   instance accidentally.
 * - The additional exports (`createPerformanceTimer`, sanitisation utilities,
 *   constants, etc.) expose shared functionality without requiring consumers to
 *   know the internal file layout.
 */
const {buildLogger,createSimpleWinstonLogger}=require('./loggerConfig'),{logStart,logReturn,logDebug,logInfo,logWarn,logError,logFatal,logAudit}=require('./loggerFunctions'),{createEnhancedLogEntry}=require('./shared/logging'),{LOG_LEVELS}=require('./shared/constants'),{sanitizeMessage,sanitizeContext}=require('./sanitization'),{createPerformanceTimer}=require('./shared/logging'),logger=buildLogger(),simpleLogger=createSimpleWinstonLogger();
class CircularLogBuffer{constructor(size=1000){const Denque=require('denque');this.maxSize=size;this.buffer=new Denque();}push(item){this.buffer.length>=this.maxSize&&this.buffer.shift();this.buffer.push(item);}splice(start,deleteCount){const result=[];for(let i=0;i<deleteCount&&this.buffer.length>0;i++)result.push(this.buffer.shift());return result;}get length(){return this.buffer.length;}isEmpty(){return this.buffer.length===0;}}const logQueue=new CircularLogBuffer(500),MAX_LOG_QUEUE_SIZE=500;let logProcessing=false,processingScheduled=false;const processLogQueue=async()=>{if(logProcessing||logQueue.length===0){processingScheduled=false;return;}logProcessing=true;const startTime=Date.now();try{const batchSize=Math.min(25,logQueue.length),batch=logQueue.splice(0,batchSize),PARALLEL_BATCH_SIZE=5;for(let i=0;i<batch.length;i+=PARALLEL_BATCH_SIZE){const parallelBatch=batch.slice(i,i+PARALLEL_BATCH_SIZE);await Promise.allSettled(parallelBatch.map(logFn=>{try{return logFn();}catch(err){console.error('Log processing error:',err.message);}}));}if(logQueue.length>0){processingScheduled=true;setImmediate(processLogQueue);}else{processingScheduled=false;}}finally{logProcessing=false;const processingTime=Date.now()-startTime;if(processingTime>100){console.warn(`Log queue processing took ${processingTime}ms - consider reducing log volume`);}}},queueLogFunction=logFunction=>async(...args)=>{logQueue.push(()=>logFunction(...args));if(!processingScheduled&&!logProcessing){processingScheduled=true;setImmediate(processLogQueue);}},boundLogStart=queueLogFunction((name,data)=>logStart(name,data,logger).catch(()=>{})),boundLogReturn=queueLogFunction((name,data)=>logReturn(name,data,logger).catch(()=>{})),boundLogDebug=queueLogFunction((message,context,requestId)=>logDebug(message,context,requestId,logger).catch(()=>{})),boundLogInfo=queueLogFunction((message,context,requestId)=>logInfo(message,context,requestId,logger).catch(()=>{})),boundLogWarn=queueLogFunction((message,context,requestId)=>logWarn(message,context,requestId,logger).catch(()=>{})),boundLogError=queueLogFunction((message,context,requestId)=>logError(message,context,requestId,logger).catch(()=>{})),boundLogFatal=queueLogFunction((message,context,requestId)=>logFatal(message,context,requestId,logger).catch(()=>{})),boundLogAudit=queueLogFunction((message,context,requestId)=>logAudit(message,context,requestId,logger).catch(()=>{}));
/**
 * Module exports - Comprehensive logging API with multiple access patterns
 * 
 * The export strategy provides:
 * - Default export: The main Winston logger instance for direct usage
 * - Bound functions: Pre-configured logging functions for convenience
 * - Utilities: Supporting functions and constants
 * - Re-exports: Shared utilities for easy access
 */
module.exports=logger;module.exports.logStart=boundLogStart;module.exports.logReturn=boundLogReturn;module.exports.logDebug=boundLogDebug;module.exports.logInfo=boundLogInfo;module.exports.logWarn=boundLogWarn;module.exports.logError=boundLogError;module.exports.logFatal=boundLogFatal;module.exports.logAudit=boundLogAudit;module.exports.createPerformanceTimer=createPerformanceTimer;module.exports.sanitizeMessage=sanitizeMessage;module.exports.sanitizeContext=sanitizeContext;module.exports.createEnhancedLogEntry=createEnhancedLogEntry;module.exports.LOG_LEVELS=LOG_LEVELS;module.exports.simpleLogger=simpleLogger;module.exports.createSimpleWinstonLogger=createSimpleWinstonLogger;