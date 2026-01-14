/**
 * @file httpInputError.ts
 * @description Custom error class for HTTP input validation errors
 * 
 * Rationale:
 * - Provides typed error handling for HTTP input validation
 * - Separates error concerns from main server logic
 * - Enables consistent error responses across HTTP handlers
 */

/**
 * Custom error for HTTP input validation failures
 * 
 * Usage:
 * ```typescript
 * if (!userId) {
 *   throw new HttpInputError(400, { error: 'userId is required' });
 * }
 * ```
 */
export class HttpInputError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: unknown
  ) {
    super('HttpInputError');
    this.name = 'HttpInputError';
  }
}

export default HttpInputError;
