/**
 * Logger module for qerrors
 */
declare class Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    logDebug: (message: string, ...args: any[]) => void;
    logInfo: (message: string, ...args: any[]) => void;
    logWarn: (message: string, ...args: any[]) => void;
    logError: (message: string, ...args: any[]) => void;
    logFatal: (message: string, ...args: any[]) => void;
    logAudit: (message: string, ...args: any[]) => void;
    createPerformanceTimer: () => {
        elapsed: () => number;
    };
    createEnhancedLogEntry: (level: string, message: string) => {
        level: string;
        message: string;
    };
    LOG_LEVELS: {
        DEBUG: number;
        INFO: number;
        WARN: number;
        ERROR: number;
        FATAL: number;
    };
    simpleLogger: this;
    createSimpleWinstonLogger: () => this;
}
declare const logger: Logger;
export default logger;
//# sourceMappingURL=logger.d.ts.map