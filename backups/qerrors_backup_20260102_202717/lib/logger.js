/**
 * Logger module for qerrors
 */
// Simple logger implementation for now
class Logger {
    info(message, ...args) {
        console.info(`[INFO] ${message}`, ...args);
    }
    error(message, ...args) {
        console.error(`[ERROR] ${message}`, ...args);
    }
    warn(message, ...args) {
        console.warn(`[WARN] ${message}`, ...args);
    }
    debug(message, ...args) {
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
    createEnhancedLogEntry = (level, message) => ({ level, message });
    LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
    simpleLogger = this;
    createSimpleWinstonLogger = () => this;
}
const logger = new Logger();
export default logger;
//# sourceMappingURL=logger.js.map