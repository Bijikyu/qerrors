// 🔗 Tests: Integration Tests for Express.js + qerrors
const express=require('express');
const request=require('supertest');
const qerrors=require('../index.js');

describe('Express.js Integration Tests',()=>{
  let app;

  beforeEach(()=>{
    app=express();
    app.use(express.json());
    app.use((err,req,res,next)=>{qerrors(err,'express middleware',req,res,next);});
  });

  describe('JSON Error Responses',()=>{
    test('should return JSON error for API requests',async()=>{
      app.get('/api/error',(req,res,next)=>{const error=new Error('API test error');error.code='TEST_ERROR';next(error);});
      const response=await request(app).get('/api/error').set('Accept','application/json');
      expect(response.status).toBe(500)&&expect(response.body).toHaveProperty('error')&&expect(response.body.error).toHaveProperty('message','API test error')&&expect(response.body.error).toHaveProperty('uniqueErrorName')&&expect(response.body.error).toHaveProperty('timestamp');
    });

    test('should handle validation errors',async()=>{
      app.post('/api/validate',(req,res,next)=>{const error=qerrors.createTypedError('Invalid input',qerrors.ErrorTypes.VALIDATION,'VALIDATION_ERROR');next(error);});
      const response=await request(app).post('/api/validate').send({}).set('Accept','application/json');
      expect(response.status).toBe(400)&&expect(response.body.error).toHaveProperty('type','validation');
    });
  });

  describe('HTML Error Responses',()=>{
    test('should return HTML error for browser requests',async()=>{
      app.get('/html/error',(req,res,next)=>{const error=new Error('<script>alert("xss")</script>');next(error);});
      const response=await request(app).get('/html/error').set('Accept','text/html');
      expect(response.status).toBe(500)&&expect(response.text).not.toContain('<script>')&&expect(response.text).toContain('<!DOCTYPE html>');
    });

    test('should escape HTML entities in error messages',async()=>{
      app.get('/html/escape',(req,res,next)=>{const error=new Error('Error with <strong>HTML</strong> & "quotes"');next(error);});
      const response=await request(app).get('/html/escape').set('Accept','text/html');
      expect(response.text).toContain('&lt;strong&gt;')&&expect(response.text).toContain('&amp;')&&expect(response.text).toContain('&quot;');
    });
  });

  describe('Controller Error Handling',()=>{
    test('should handle controller errors gracefully',async()=>{
      app.post('/controller/error',async(req,res)=>{try{throw new Error('Controller operation failed');}catch(error){await qerrors.handleControllerError(res,error,'testController',req.body,'User-friendly message');}});
      const response=await request(app).post('/controller/error').send({data:'test'});
      expect(response.status).toBe(500)&&expect(response.body).toHaveProperty('message','User-friendly message');
    });

    test('should handle authentication errors',async()=>{
      app.post('/auth/login',async(req,res)=>{try{throw qerrors.createTypedError('Invalid credentials',qerrors.ErrorTypes.AUTHENTICATION,'AUTH_FAILED');}catch(error){await qerrors.handleControllerError(res,error,'authController',req.body);}});
      const response=await request(app).post('/auth/login').send({username:'test',password:'wrong'});
      expect(response.status).toBe(401)&&expect(response.body.error).toHaveProperty('type','authentication');
    });
  });

  describe('Error Severity Integration',()=>{
    test('should handle critical errors',async()=>{
      app.get('/critical',async(req,res,next)=>{const error=new Error('Critical system failure');await qerrors.logErrorWithSeverity(error,'criticalOperation',req.query,qerrors.ErrorSeverity.CRITICAL);next(error);});
      const response=await request(app).get('/critical').set('Accept','application/json');
      expect(response.status).toBe(500);
    });
  });

  describe('Concurrent Error Handling',()=>{
    test('should handle multiple concurrent errors',async()=>{
      app.get('/concurrent',async(req,res,next)=>{
        const promises=[];
        for(let i=0;i<10;i++){
          promises.push(qerrors.logErrorWithSeverity(new Error(`Concurrent error ${i}`),'concurrentOperation',{index:i},qerrors.ErrorSeverity.MEDIUM));
        }
        await Promise.all(promises);
        next(new Error('Main error'));
      });
      const response=await request(app).get('/concurrent').set('Accept','application/json');
      expect(response.status).toBe(500);
    });
  });
});