import qerrors from '../lib/qerrors.js';

const setupDataRoute = (app) => {
  app.get('/api/data', async (req, res, next) => {
    try {
      const data = {
        message: 'Sample data for testing',
        timestamp: new Date().toISOString(),
        data: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
          value: Math.random() * 100
        }))
      };
      
      res.json({
        success: true,
        data,
        count: data.data.length
      });
    } catch (error) {
      next(error);
    }
  });
};

const setupErrorRoute = (app) => {
  app.get('/api/error', (req, res, next) => {
    const errorType = req.query.type || 'basic';
    
    switch (errorType) {
      case 'type':
        next(new TypeError('Invalid type provided'));
        break;
      case 'reference':
        next(new ReferenceError('Property not found'));
        break;
      case 'range':
        next(new RangeError('Value out of range'));
        break;
      case 'syntax':
        next(new SyntaxError('Invalid syntax'));
        break;
      case 'custom':
        next(new Error('Custom error with special characters: <script>alert("xss")</script>'));
        break;
      default:
        next(new Error('Basic error for testing'));
        break;
    }
  });
};

const setupValidationRoute = (app) => {
  app.post('/api/validate', (req, res, next) => {
    try {
      const { email, name, age } = req.body;
      
      const errors = [];
      
      if (!email || !email.includes('@')) {
        errors.push('Valid email is required');
      }
      
      if (!name || name.length < 2) {
        errors.push('Name must be at least 2 characters');
      }
      
      if (!age || age < 0 || age > 150) {
        errors.push('Age must be between 0 and 150');
      }
      
      if (errors.length > 0) {
        const validationError = new Error('Validation failed');
        validationError.validationErrors = errors;
        next(validationError);
        return;
      }
      
      res.json({
        success: true,
        message: 'Validation successful',
        data: { email, name, age }
      });
    } catch (error) {
      next(error);
    }
  });
};

function setupErrorTriggerRoute(app) {
  app.post('/api/errors/trigger', (req, res, next) => {
    try {
      const { type, message, context } = req.body;
      
      let error;
      
      switch (type) {
        case 'async':
          setTimeout(() => {
            error = new Error(message || 'Async error occurred');
            error.context = context;
            next(error);
          }, 100);
          return;
          
        case 'promise':
          Promise.reject(new Error(message || 'Promise rejected'))
            .catch(err => next(err));
          return;
          
        case 'timeout':
          setTimeout(() => {
            error = new Error(message || 'Operation timed out');
            error.code = 'TIMEOUT';
            next(error);
          }, 5000);
          return;
          
        default:
          error = new Error(message || 'Error triggered');
          error.context = context;
          next(error);
          break;
      }
    } catch (error) {
      next(error);
    }
  });
}

const setupCustomErrorRoute = (app) => {
  app.post('/api/errors/custom', (req, res, next) => {
    try {
      const { 
        errorType, 
        message, 
        code, 
        severity, 
        stack, 
        context 
      } = req.body;
      
      const error = new Error(message || 'Custom error');
      
      if (errorType) error.name = errorType;
      if (code) error.code = code;
      if (severity) error.severity = severity;
      if (stack) error.stack = stack;
      if (context) error.context = context;
      
      next(error);
    } catch (error) {
      next(error);
    }
  });
}

const setupAnalysisRoute = (app) => {
  app.post('/api/errors/analyze', async (req, res, next) => {
    try {
      const { errorData, enableAnalysis } = req.body;
      
      const error = new Error(errorData.message || 'Error to analyze');
      if (errorData.name) error.name = errorData.name;
      if (errorData.code) error.code = errorData.code;
      
      if (enableAnalysis) {
        await qerrors(error, 'api-server.routes.analyze', {
          endpoint: '/api/errors/analyze',
          errorData,
          analysisRequested: true
        }, req, res, next);
      } else {
        res.json({
          success: false,
          error: error.message,
          name: error.name,
          code: error.code,
          analysis: 'disabled'
        });
      }
    } catch (error) {
      next(error);
    }
  });
};

const setupHtmlErrorRoute = (app) => {
  app.get('/html/error', (req, res, next) => {
    try {
      const userInput = req.query.input || '';
      const error = new Error(`HTML error with input: ${userInput}`);
      next(error);
    } catch (error) {
      next(error);
    }
  });
};

const setupHtmlEscapeRoute = (app) => {
  app.get('/html/escape', (req, res, next) => {
    try {
      const { unsafe } = req.query;
      
      if (!unsafe) {
        return res.send(`
          <h1>HTML Escape Demo</h1>
          <form>
            <input type="text" name="unsafe" placeholder="Enter HTML code">
            <button type="submit">Test</button>
          </form>
        `);
      }
      
      const error = new Error(`Unsafe HTML: ${unsafe}`);
      next(error);
    } catch (error) {
      next(error);
    }
  });
};

const setupControllerErrorRoute = (app) => {
  app.post('/controller/error', (req, res, next) => {
    try {
      const { userMessage } = req.body;
      
      qerrors.handleControllerError(
        res, 
        new Error('Controller operation failed'), 
        'api-server.routes.controller',
        { endpoint: '/controller/error', body: req.body },
        userMessage || 'An error occurred in controller'
      ).catch(next);
    } catch (error) {
      next(error);
    }
  });
};

const setupAuthRoute = (app) => {
  app.post('/auth/login', async (req, res, next) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        const authError = new Error('Username and password are required');
        authError.code = 'AUTH_MISSING_CREDENTIALS';
        return next(authError);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (username !== 'admin' || password !== 'password') {
        const authError = new Error('Invalid username or password');
        authError.code = 'AUTH_INVALID_CREDENTIALS';
        authError.attempts = 3;
        return next(authError);
      }
      
      res.json({
        success: true,
        message: 'Authentication successful',
        token: 'mock-jwt-token-12345',
        user: { username, role: 'admin' }
      });
    } catch (error) {
      next(error);
    }
  });
};

function setupRoutes(app) {
  setupDataRoute(app);
  setupErrorRoute(app);
  setupValidationRoute(app);
  setupErrorTriggerRoute(app);
  setupCustomErrorRoute(app);
  setupAnalysisRoute(app);
  setupHtmlErrorRoute(app);
  setupHtmlEscapeRoute(app);
  setupControllerErrorRoute(app);
  setupAuthRoute(app);
}

export {
  setupRoutes,
  setupDataRoute,
  setupErrorRoute,
  setupValidationRoute,
  setupErrorTriggerRoute,
  setupCustomErrorRoute,
  setupAnalysisRoute,
  setupHtmlErrorRoute,
  setupHtmlEscapeRoute,
  setupControllerErrorRoute,
  setupAuthRoute
};