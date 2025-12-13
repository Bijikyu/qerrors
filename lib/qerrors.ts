/**
 * Main qerrors function - intelligent error handling middleware
 */

import { randomUUID } from 'crypto';
// @ts-ignore - escape-html doesn't have types
import escapeHtml from 'escape-html';

/**
 * Main qerrors middleware function
 * @param error - Error to handle
 * @param context - Context where error occurred
 * @param args - Additional arguments (req, res, next)
 */
const qerrors = async (error: Error, context: string, ...args: any[]): Promise<void> => {
  const errorId = randomUUID();
  const timestamp = new Date().toISOString();
  
  // Basic error logging
  console.error(`[${timestamp}] ${context}: ${error.message}`, {
    errorId,
    stack: error.stack,
    context
  });
  
  // Handle Express middleware pattern
  if (args.length >= 3) {
    const [req, res, next] = args;
    
    if (res && !res.headersSent) {
      const acceptsHtml = req?.headers?.accept?.includes('text/html');
      
      if (acceptsHtml) {
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Error: 500</title></head>
          <body>
              <h1 class="error">Error: 500</h1>
              <h2>Internal Server Error</h2>
              <pre>${escapeHtml(error.stack || error.message)}</pre>
          </body>
          </html>
        `);
      } else {
        res.status(500).json({
          error: {
            uniqueErrorName: `ERROR:${error.name}_${errorId}`,
            timestamp,
            message: error.message,
            statusCode: 500,
            context,
            stack: error.stack
          }
        });
      }
    }
    
    if (next) next();
  }
};

// Export additional methods that will be implemented later
qerrors.logErrorWithSeverity = async (error: Error, functionName: string, context?: Record<string, any>, severity?: string): Promise<void> => {
  console.error(`[${severity?.toUpperCase() || 'ERROR'}] ${functionName}:`, error.message, context);
};

qerrors.handleControllerError = (res: any, error: Error, functionName: string, _context?: Record<string, any>, userMessage?: string): void => {
  console.error(`Controller error in ${functionName}:`, error.message);
  
  if (res && !res.headersSent) {
    res.status(500).json({
      error: userMessage || 'An internal error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

qerrors.withErrorHandling = (fn: Function) => async (...args: any[]) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error('Error in wrapped function:', error);
    throw error;
  }
};

export default qerrors;