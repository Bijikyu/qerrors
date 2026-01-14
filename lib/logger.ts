/**
 * Logger module for qerrors
 */

/**
 * Standardized application logger interface
 */
export type AppLogger = {
  info: (m: string, meta?: Record<string, unknown>) => void;
  warn: (m: string, meta?: Record<string, unknown>) => void;
  error: (m: string, meta?: Record<string, unknown>) => void;
  debug: (m: string, meta?: Record<string, unknown>) => void;
};

// Simple logger implementation for now
class Logger implements AppLogger {
  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }
  
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
  
  // Add the methods that are expected by the index.ts
  logDebug = this.debug;
  logInfo = this.info;
  logWarn = this.warn;
  logError = this.error;
  logFatal = this.error;
  logAudit = this.info;
  createPerformanceTimer = () => ({ elapsed: () => Date.now() });
  createEnhancedLogEntry = (level: string, message: string) => ({ level, message });
  LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
  simpleLogger = this;
  createSimpleWinstonLogger = () => this;
}

const logger = new Logger();

/**
 * Get the application logger instance
 * Returns a standardized AppLogger interface
 */
export const getAppLogger = (): AppLogger => logger;

export default logger;