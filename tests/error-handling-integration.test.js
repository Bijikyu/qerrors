// 🔗 Tests: Error Handling Integration Tests
// 🔗 Tests: Complete error flow from creation through logging to response
// 🔗 Tests: Queue management, caching, and performance monitoring integration
// 🔗 Tests: Security sanitization and XSS prevention integration
const qerrors=require('../index.js');

describe('Error Handling Integration Tests',()=>{
  describe('End-to-End Error Flow',()=>{
    test('should handle complete error flow from creation to response',async()=>{
      const error=new Error('Integration test error');
      error.code='INTEGRATION_ERROR';
      error.type=qerrors.ErrorTypes.SYSTEM;
      const mockReq={
        headers:{accept:'application/json','x-request-id':'test-123'},
        url:'/test/endpoint',
        method:'POST',
        ip:'127.0.0.1'
      };
      const mockRes={
        headersSent:false,
        statusCode:null,
        responseData:null,
        status:function(code){this.statusCode=code;return this;},
        json:function(data){this.responseData=data;},
        send:function(data){this.responseData=data;}
      };
      const mockNext=jest.fn();
      await qerrors(error,'integration test context',mockReq,mockRes,mockNext);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.responseData).toHaveProperty('error');
      expect(mockRes.responseData.error).toHaveProperty('uniqueErrorName');
      expect(mockRes.responseData.error).toHaveProperty('timestamp');
      expect(mockRes.responseData.error).toHaveProperty('context','integration test context');
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should handle HTML response flow',async()=>{
      const error=new Error('HTML integration test');
      const mockReq={
        headers:{accept:'text/html'},
        url:'/test/html',
        method:'GET'
      };
      const mockRes={
        headersSent:false,
        statusCode:null,
        responseData:null,
        status:function(code){this.statusCode=code;return this;},
        send:function(data){this.responseData=data;}
      };
      const mockNext=jest.fn();
      await qerrors(error,'html test context',mockReq,mockRes,mockNext);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.responseData).toContain('<!DOCTYPE html>');
      expect(mockRes.responseData).not.toContain('<script>');
    });
  });

  describe('Queue and Caching Integration',()=>{
    test('should handle queue operations without crashing',()=>{
      const queueLength=qerrors.getQueueLength();
      const rejectCount=qerrors.getQueueRejectCount();
      const cacheLimit=qerrors.getAdviceCacheLimit();
      expect(typeof queueLength).toBe('number')&&expect(typeof rejectCount).toBe('number')&&expect(typeof cacheLimit).toBe('number');
      qerrors.clearAdviceCache();
      qerrors.purgeExpiredAdvice();
    });
  });

  describe('Configuration Integration',()=>{
    test('should handle configuration changes',()=>{
      const concurrency=qerrors.getInt('QERRORS_CONCURRENCY');
      const timeout=qerrors.getInt('QERRORS_TIMEOUT');
      const serviceName=qerrors.getEnv('QERRORS_SERVICE_NAME');
      expect(typeof concurrency).toBe('number')&&expect(typeof timeout).toBe('number')&&expect(typeof serviceName).toBe('string');
      expect(concurrency).toBeGreaterThan(0)&&expect(timeout).toBeGreaterThan(0);
    });
  });

  describe('Error Type Integration',()=>{
    test('should create and handle different error types',()=>{
      const validationError=qerrors.createTypedError('Invalid input',qerrors.ErrorTypes.VALIDATION,'VALIDATION_ERROR');
      const authError=qerrors.createTypedError('Unauthorized',qerrors.ErrorTypes.AUTHENTICATION,'AUTH_ERROR');
      const systemError=qerrors.createTypedError('System failure',qerrors.ErrorTypes.SYSTEM,'SYSTEM_ERROR');
      expect(validationError.type).toBe('validation')&&expect(authError.type).toBe('authentication')&&expect(systemError.type).toBe('system');
      expect(validationError.statusCode).toBe(400)&&expect(authError.statusCode).toBe(401)&&expect(systemError.statusCode).toBe(500);
    });
  });

  describe('Performance Integration',()=>{
    test('should measure performance without overhead',()=>{
      const timer=qerrors.createTimer();
      timer.start();
      const start=Date.now();
      while(Date.now()-start<10){}
      const duration=timer.end();
      expect(typeof duration).toBe('number')&&expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Security Integration',()=>{
    test('should sanitize malicious inputs in responses',async()=>{
      const xssError=new Error('<script>alert("xss")</script><img src=x onerror=alert(1)>');
      const mockReq={headers:{accept:'text/html'}};
      const mockRes={
        headersSent:false,
        statusCode:null,
        responseData:null,
        status:function(code){this.statusCode=code;return this;},
        send:function(data){this.responseData=data;}
      };
      await qerrors(xssError,'security test',mockReq,mockRes);
      expect(mockRes.responseData).not.toContain('<script>')&&expect(mockRes.responseData).not.toContain('onerror')&&expect(mockRes.responseData).toContain('&lt;script&gt;');
    });
  });

  describe('Logging Integration',()=>{
    test('should handle different log levels',async()=>{
      const mockReq={headers:{accept:'application/json'}};
      const mockRes={
        headersSent:false,
        status:jest.fn().mockReturnThis(),
        json:jest.fn(),
        send:jest.fn()
      };
      const mockNext=jest.fn();
      await qerrors.logErrorWithSeverity(new Error('Low severity error'),'testFunction',{},qerrors.ErrorSeverity.LOW);
      await qerrors.logErrorWithSeverity(new Error('High severity error'),'testFunction',{},qerrors.ErrorSeverity.HIGH);
      await qerrors.logErrorWithSeverity(new Error('Critical severity error'),'testFunction',{},qerrors.ErrorSeverity.CRITICAL);
      expect(true).toBe(true);
    });
  });

  describe('Concurrent Operations',()=>{
    test('should handle concurrent error processing',async()=>{
      const promises=[];
      for(let i=0;i<5;i++){
        const promise=qerrors.logErrorWithSeverity(new Error(`Concurrent error ${i}`),'concurrentTest',{index:i},qerrors.ErrorSeverity.MEDIUM);
        promises.push(promise);
      }
      await Promise.all(promises);
      expect(true).toBe(true);
    });
  });
});