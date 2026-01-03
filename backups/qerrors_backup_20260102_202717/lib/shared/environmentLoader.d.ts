/**
 * Load dotenv configuration if not already loaded
 *
 * This function ensures dotenv is only loaded once per application lifecycle,
 * preventing redundant configuration attempts and associated errors.
 *
 * @returns {Promise<void>} Promise that resolves when dotenv is loaded (or failed gracefully)
 */
export function loadDotenv(): Promise<void>;
/**
 * Check if .env file exists in the current working directory
 *
 * Uses caching to avoid repeated filesystem access calls. The cache is
 * initialized on first call and reused for subsequent calls.
 *
 * @returns {Promise<boolean>} Promise that resolves to true if .env file exists, false otherwise
 */
export function checkEnvFileExists(): Promise<boolean>;
/**
 * Synchronous check for .env file existence (for backward compatibility)
 *
 * @returns {boolean} True if .env file exists, false otherwise
 */
export function checkEnvFileSync(): boolean;
/**
 * Reset cached state (useful for testing or environment changes)
 *
 * This function clears all cached values, forcing the next calls to
 * re-evaluate the current state. Primarily intended for testing scenarios.
 */
export function resetCache(): void;
//# sourceMappingURL=environmentLoader.d.ts.map