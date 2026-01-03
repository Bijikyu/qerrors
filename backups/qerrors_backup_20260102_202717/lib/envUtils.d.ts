/**
 * Check which environment variables are missing from the current environment
 *
 * This function filters an array of environment variable names to identify
 * which ones are not currently set in process.env. It's used by other
 * validation functions to determine configuration completeness.
 *
 * @param {string[]} varArr - Array of environment variable names to check
 * @returns {string[]} Array of missing environment variable names
 *
 * Example:
 * const missing = getMissingEnvVars(['API_KEY', 'DB_URL']);
 * console.log(missing); // ['API_KEY'] if API_KEY is not set
 */
export function getMissingEnvVars(varArr: string[]): string[];
/**
 * Validate required environment variables and throw error if any are missing
 *
 * This function performs strict validation of required environment variables.
 * If any variables from the provided array are missing, it will throw a detailed
 * error message and also log the error to console for visibility.
 *
 * Use this function when your application cannot function without specific
 * environment variables being set. This is ideal for API keys, database URLs,
 * and other critical configuration that must be present for the application
 * to operate correctly.
 *
 * @param {string[]} varArr - Array of required environment variable names
 * @returns {string[]} Array of missing environment variable names (empty if all present)
 * @throws {Error} If any required environment variables are missing
 *
 * Example:
 * try {
 *   throwIfMissingEnvVars(['OPENAI_API_KEY', 'DATABASE_URL']);
 *   console.log('All required variables are present');
 * } catch (error) {
 *   console.error('Configuration error:', error.message);
 *   process.exit(1);
 * }
 */
export function throwIfMissingEnvVars(varArr: string[]): string[];
/**
 * Validate optional environment variables and log warning if any are missing
 *
 * This function performs lenient validation of optional environment variables.
 * Instead of throwing an error, it logs a warning message to inform developers
 * that some optional configuration is missing. This allows the application
 * to continue running while providing visibility into potentially missing
 * functionality.
 *
 * Use this function for environment variables that enhance functionality
 * but are not required for basic operation. Examples include feature flags,
 * optional service URLs, or configuration that has sensible defaults.
 *
 * @param {string[]} varArr - Array of optional environment variable names
 * @param {string} [customMessage=''] - Custom warning message to display instead of default
 * @returns {boolean} True if all optional variables are present, false otherwise
 *
 * Example:
 * const isComplete = warnIfMissingEnvVars(['REDIS_URL', 'FEATURE_FLAG_X']);
 * if (!isComplete) {
 *   console.log('Some optional features may not be available');
 * }
 */
export function warnIfMissingEnvVars(varArr: string[], customMessage?: string): boolean;
/**
 * Alias for throwIfMissingEnvVars - validates required environment variables
 *
 * This function provides a more descriptive name for the same functionality
 * as throwIfMissingEnvVars. It's useful when you want to be explicit about
 * validating required variables in your code.
 *
 * @param {string[]} vars - Array of required environment variable names
 * @returns {string[]} Array of missing environment variable names
 * @throws {Error} If any required environment variables are missing
 */
export function validateRequiredEnvVars(vars: string[]): string[];
/**
 * Alias for warnIfMissingEnvVars - validates optional environment variables
 *
 * This function provides a more descriptive name for the same functionality
 * as warnIfMissingEnvVars. It's useful when you want to be explicit about
 * validating optional variables in your code.
 *
 * @param {string[]} vars - Array of optional environment variable names
 * @returns {boolean} True if all optional variables are present, false otherwise
 */
export function warnMissingEnvVars(vars: string[]): boolean;
/**
 * Check if .env file exists in the current working directory
 *
 * This function detects the presence of a .env file, which is commonly
 * used for local development environment configuration. The presence
 * of this file indicates that environment variables may be loaded from
 * a file rather than being set directly in the system environment.
 *
 * @returns {Promise<boolean>} True if .env file exists, false otherwise
 *
 * Example:
 * const exists = await hasEnvFile();
 * if (exists) {
 *   console.log('Environment variables may be loaded from .env file');
 * } else {
 *   console.log('Using system environment variables only');
 * }
 */
export function hasEnvFile(): Promise<boolean>;
/**
 * Synchronous version for backward compatibility - DEPRECATED
 * Use async hasEnvFile() instead to avoid blocking operations
 * @returns {boolean} Cached result or synchronous check
 */
export function hasEnvFileSync(): boolean;
/**
 * Generate comprehensive environment health report
 *
 * This function provides a detailed analysis of the current environment
 * configuration, including which required and optional variables are set,
 * which are missing, and overall configuration health status. It's useful
 * for debugging configuration issues and for monitoring environment state
 * in production applications.
 *
 * The returned object includes metrics for both required and optional
 * variables, allowing you to track configuration completeness over time.
 *
 * @param {string[]} [requiredVars=[]] - Array of required environment variable names
 * @param {string[]} [optionalVars=[]] - Array of optional environment variable names
 * @returns {Object} Comprehensive environment health report
 * @returns {string} returns.environment - Current NODE_ENV value
 * @returns {boolean} returns.hasEnvFile - Whether .env file exists
 * @returns {boolean} returns.isHealthy - Whether all required variables are present
 * @returns {Object} returns.required - Metrics for required variables
 * @returns {Object} returns.optional - Metrics for optional variables
 * @returns {Object} returns.summary - Overall configuration summary
 *
 * Example:
 * const health = getEnvHealth(
 *   ['API_KEY', 'DATABASE_URL'],           // required variables
 *   ['REDIS_URL', 'DEBUG_MODE']            // optional variables
 * );
 *
 * if (!health.isHealthy) {
 *   console.error('Environment is not healthy:', health.required.missing);
 * }
 *
 * console.log(`Configuration completeness: ${health.summary.configuredVars}/${health.summary.totalVars}`);
 */
export function getEnvHealth(requiredVars?: string[], optionalVars?: string[]): Object;
/**
 * Synchronous version for backward compatibility
 */
export function getEnvHealthSync(requiredVars?: any[], optionalVars?: any[]): {
    environment: string;
    hasEnvFile: boolean;
    isHealthy: boolean;
    required: {
        total: number;
        configured: number;
        missing: string[];
    };
    optional: {
        total: number;
        configured: number;
        missing: string[];
    };
    summary: {
        totalVars: number;
        configuredVars: number;
    };
};
/**
 * Comprehensive environment validation with configurable error handling
 *
 * This function provides a unified interface for environment validation,
 * combining the functionality of getEnvHealth with configurable error
 * handling. It's useful for application startup validation where you
 * want either strict validation (throw on error) or lenient validation
 * (return health report) based on configuration.
 *
 * The function is designed to be flexible, allowing you to validate
 * different sets of variables in different contexts while maintaining
 * consistent error reporting and health metrics.
 *
 * @param {Object} [options={}] - Configuration options for validation
 * @param {string[]} [options.required=[]] - Required environment variables
 * @param {string[]} [options.optional=[]] - Optional environment variables
 * @param {boolean} [options.throwOnError=true] - Whether to throw error on missing required vars
 * @returns {Object} Environment health report (same format as getEnvHealth)
 * @throws {Error} If throwOnError is true and required variables are missing
 *
 * Example:
 * // Strict validation - throws error on missing required variables
 * try {
 *   const health = validateEnvironment({
 *     required: ['API_KEY', 'DATABASE_URL'],
 *     optional: ['REDIS_URL'],
 *     throwOnError: true
 *   });
 *   console.log('Environment is healthy:', health.isHealthy);
 * } catch (error) {
 *   console.error('Environment validation failed:', error.message);
 * }
 *
 * // Lenient validation - returns health report without throwing
 * const health = validateEnvironment({
 *   required: ['API_KEY', 'DATABASE_URL'],
 *   optional: ['REDIS_URL'],
 *   throwOnError: false
 * });
 *
 * if (!health.isHealthy) {
 *   console.warn('Environment has issues:', health.required.missing);
 * }
 */
export function validateEnvironment(options?: {
    required?: string[] | undefined;
    optional?: string[] | undefined;
    throwOnError?: boolean | undefined;
}): Object;
/**
 * Synchronous version for backward compatibility
 */
export function validateEnvironmentSync(options?: {}): {
    environment: string;
    hasEnvFile: boolean;
    isHealthy: boolean;
    required: {
        total: number;
        configured: number;
        missing: string[];
    };
    optional: {
        total: number;
        configured: number;
        missing: string[];
    };
    summary: {
        totalVars: number;
        configuredVars: number;
    };
};
export const NODE_ENV: string;
export const DEFAULT_ERROR_MESSAGE: "An unexpected error occurred";
export const loadDotenv: () => Promise<void>;
//# sourceMappingURL=envUtils.d.ts.map