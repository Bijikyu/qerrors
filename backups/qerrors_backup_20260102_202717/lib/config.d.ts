export const defaults: {
    QERRORS_CONCURRENCY: string;
    QERRORS_CACHE_LIMIT: string;
    QERRORS_CACHE_TTL: string;
    QERRORS_QUEUE_LIMIT: string;
    QERRORS_SAFE_THRESHOLD: string;
    QERRORS_RETRY_ATTEMPTS: string;
    QERRORS_RETRY_BASE_MS: string;
    QERRORS_RETRY_MAX_MS: string;
    QERRORS_TIMEOUT: string;
    QERRORS_MAX_SOCKETS: string;
    QERRORS_MAX_FREE_SOCKETS: string;
    QERRORS_MAX_TOKENS: string;
    QERRORS_OPENAI_URL: string;
    QERRORS_LOG_MAXSIZE: string;
    QERRORS_LOG_MAXFILES: string;
    QERRORS_LOG_MAX_DAYS: string;
    QERRORS_VERBOSE: string;
    QERRORS_LOG_DIR: string;
    QERRORS_DISABLE_FILE_LOGS: string;
    QERRORS_SERVICE_NAME: string;
    QERRORS_LOG_LEVEL: string;
    QERRORS_METRIC_INTERVAL_MS: string;
};
export function getEnv(name: any, defaultVal: any): any;
export function safeRun(name: any, fn: any, fallback: any, info: any): any;
export function getInt(name: any, defaultValOrMin: any, min: any): number;
export function validateRequiredVars(varNames: any): {
    isValid: boolean;
    missing: any[];
    present: any[];
};
export function getConfigSummary(): Promise<{
    environment: string;
    hasEnvFile: boolean;
    configuredVars: string[];
    totalVars: number;
}>;
export function getConfigSummarySync(): {
    environment: string;
    hasEnvFile: boolean;
    configuredVars: string[];
    totalVars: number;
};
import { loadDotenv } from "./shared/environmentLoader";
export { loadDotenv };
//# sourceMappingURL=config.d.ts.map