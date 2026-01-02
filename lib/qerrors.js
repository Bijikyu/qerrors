'use strict';

const{randomUUID}=require('crypto'),errorTypes=require('./errorTypes'),logger=require('./logger'),escapeHtml=require('escape-html'),localVars=require('../config/localVars'),{scheduleAnalysis,getQueueRejectCount,getQueueLength}=require('./qerrorsQueue'),{clearAdviceCache,purgeExpiredAdvice,startAdviceCleanup,stopAdviceCleanup}=require('./qerrorsCache'),{axiosInstance,postWithRetry}=require('./qerrorsHttpClient'),{analyzeError}=require('./qerrorsAnalysis'),{ADVICE_CACHE_LIMIT}=require('./qerrorsConfig'),{ScalableErrorHandler}=require('./scalabilityFixes');

let scalableErrorHandler=null,shutdownListenersAdded=false,cleanupInterval=null;

const getScalableErrorHandler=()=>scalableErrorHandler||(scalableErrorHandler=new ScalableErrorHandler({maxErrorHistory:50,queue:{maxQueueSize:200,maxConcurrency:2},cache:{maxSize:100,ttl:300000}}));

const addShutdownListeners=()=>{!shutdownListenersAdded&&(process.on('SIGTERM',()=>{console.log('Received SIGTERM, cleaning up qerrors...');cleanup();}),process.on('SIGINT',()=>{console.log('Received SIGINT, cleaning up qerrors...');cleanup();}),shutdownListenersAdded=true);};

const cleanup=()=>{try{clearAdviceCache();cleanupInterval&&clearInterval(cleanupInterval);stopAdviceCleanup();console.log('qerrors cleanup completed');}catch(error){console.error('Error during qerrors cleanup:',error);}};

const generateErrorId=()=>randomUUID().replace(/-/g,'').substring(0,12);

const extractContext=(error,context={})=>{try{const safeContext={timestamp:new Date().toISOString(),errorType:error.constructor.name,message:error.message,stack:error.stack?error.stack.split('\n').slice(0,10):[],...context};safeContext.password&&delete safeContext.password;safeContext.token&&delete safeContext.token;safeContext.apiKey&&delete safeContext.apiKey;return safeContext;}catch(extractionError){console.error('Failed to extract error context:',extractionError.message);return{timestamp:new Date().toISOString(),extractionFailed:true};}};

const qerrors=(error,location,context={})=>{try{const handler=getScalableErrorHandler();return handler.handleError(error,location,context);}catch(handlingError){console.error('qerrors failed to handle error:',handlingError.message);error&&error.message&&console.error('Original error:',error.message);error&&error.stack&&console.error(error.stack);return null;}};

const qerrorsMiddleware=(options={})=>{const handler=getScalableErrorHandler();return(error,req,res,next)=>{try{const context=extractContext(error,{url:req.url,method:req.method,userAgent:req.get('User-Agent'),ip:req.ip||req.connection.remoteAddress});handler.handleError(error,'express.middleware',context).then(result=>{req.accepts('html')?sendHtmlError(res,error,result):sendJsonError(res,error,result);}).catch(middlewareError=>{console.error('Middleware error:',middlewareError);sendFallbackError(res,error);}).finally(()=>next&&next());}catch(middlewareError){console.error('Express middleware failed:',middlewareError.message);sendFallbackError(res,error);next&&next();}};};

const sendHtmlError=(res,error,analysis)=>res.status(500).set('Content-Type','text/html').send(`<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Internal Server Error</h1><p>Error ID: ${analysis.errorId||'N/A'}</p><pre>${escapeHtml(error.message||'Unknown error')}</pre></body></html>`);

const sendJsonError=(res,error,analysis)=>res.status(500).json({error:'Internal Server Error',errorId:analysis.errorId,message:error.message,timestamp:new Date().toISOString()});

const sendFallbackError=(res,error)=>{try{const errorId=generateErrorId();(res.get('Content-Type')||'').includes('html')?res.status(500).send(`Error ID: ${errorId}`):res.status(500).json({error:'Internal Server Error',errorId});}catch(fallbackError){console.error('Failed to send fallback error:',fallbackError);res.status(500).end('Internal Server Error');}};

addShutdownListeners();module.exports=qerrors;module.exports.middleware=qerrorsMiddleware;module.exports.generateErrorId=generateErrorId;module.exports.extractContext=extractContext;module.exports.cleanup=cleanup;module.exports.getQueueStats=()=>({length:getQueueLength(),rejectCount:getQueueRejectCount()});module.exports.getAnalysisCache=()=>({clear:clearAdviceCache,purgeExpired:purgeExpiredAdvice,startCleanup:startAdviceCleanup,stopCleanup:stopAdviceCleanup});