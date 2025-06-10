


/**
 * Identifies which environment variables from a given list are missing
 * 
 * This function serves as the foundation for all other environment validation.
 * It uses Array.filter to efficiently check multiple variables in a single pass.
 * The function is designed to be pure (no side effects) and reusable.
 * 
 * @param {string[]} varArr - Array of environment variable names to check
 * @returns {string[]} Array of missing variable names (empty if all present)
 */
function getMissingEnvVars(varArr) {
       const missingArr = varArr.filter(name => !process.env[name]); //identify missing environment variables
       return missingArr; //return filtered array
}

/**
 * Throws an error if any required environment variables are missing
 * 
 * This function implements the "fail fast" principle for critical configuration.
 * It's designed for variables that are absolutely required for application function.
 * The thrown error includes all missing variables to help developers fix all issues at once.
 * 
 * @param {string[]} varArr - Array of required environment variable names
 * @throws {Error} If any variables are missing, with descriptive message
 * @returns {string[]} Empty array if no variables are missing (for testing purposes)
 */
function throwIfMissingEnvVars(varArr) {
       const missingEnvVars = getMissingEnvVars(varArr); //reuse detection utility

       if (missingEnvVars.length > 0) {
               const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`; //(construct descriptive error message listing all missing vars)
               console.error(errorMessage); //(log prior to throw for immediate visibility)
               const err = new Error(errorMessage); //(create error object with detailed message)
               console.error(err); //(log error instead of calling qerrors to avoid infinite recursion in error handling module)
               throw err; //(propagate failure to stop application startup when critical config missing)
       }

       return missingEnvVars; //(return empty array when all required vars present, useful for testing)
}

/**
 * Logs warnings for missing optional environment variables
 * 
 * This function handles variables that enhance functionality but aren't strictly required.
 * It uses console.warn rather than throwing errors to allow graceful degradation.
 * The function is designed to provide helpful feedback without breaking the application.
 * 
 * @param {string[]} varArr - Array of optional environment variable names to check
 * @param {string} customMessage - Custom warning message to display (optional)
 * @returns {boolean} True if all variables are present, otherwise false
 */
function warnIfMissingEnvVars(varArr, customMessage = '') {
       const missingEnvVars = getMissingEnvVars(varArr); //reuse detection utility

       if (missingEnvVars.length > 0) {
               const warningMessage = customMessage ||
                       `Warning: Optional environment variables missing: ${missingEnvVars.join(', ')}. Some features may not work as expected.`; //(construct warning message with fallback default text)
               console.warn(warningMessage); //(log warning for optional vars without breaking application flow)
       }

       const result = missingEnvVars.length === 0; //(determine if any vars missing, compute boolean for simpler return type)
       return result; //(inform caller if all vars present, boolean instead of array for cleaner API)
}

module.exports = { //(export environment validation utilities for use across qerrors module)
       getMissingEnvVars, //(core detection function for identifying missing vars)
       throwIfMissingEnvVars, //(fail-fast validation for critical configuration)
       warnIfMissingEnvVars //(graceful degradation validation for optional configuration)
};
