/**
 * Entity Guards Module - Type-Safe Entity Validation Utilities
 * 
 * Purpose: Provides a comprehensive set of type-safe utility functions for
 * validating and guarding against null/undefined entities in TypeScript.
 * These functions help prevent runtime errors by ensuring entities exist
 * before they are used, with clear error messages and type preservation.
 * 
 * Design Rationale:
 * - Type safety: All functions preserve generic type information
 * - Null safety: Comprehensive protection against null/undefined values
 * - Clear errors: Descriptive error messages for debugging
 * - Functional style: Pure functions that are easy to test and compose
 * - Performance: Minimal overhead for entity validation
 * 
 * Use Cases:
 * - Database query result validation
 * - API response entity checking
 * - Configuration entity verification
 * - Dependency injection entity validation
 * - Service layer entity guards
 */

/**
 * Throw error if entity is not found (null/undefined)
 * 
 * Purpose: Validates that an entity exists and throws a descriptive error
 * if it doesn't. This function preserves the entity type through generics,
 * ensuring type safety after the validation passes.
 * 
 * Type Safety:
 * - Generic type T is preserved when entity exists
 * - Function throws, so return type is guaranteed to be T
 * - Compiler understands entity is non-null after function call
 * 
 * @param entity - Entity to validate (can be null/undefined)
 * @param entityName - Name of entity for error message context
 * @returns Validated non-null entity of type T
 * @throws Error when entity is null or undefined
 */
export const throwIfNotFound = <T>(entity: T | null | undefined, entityName: string): T => {
  if (!entity) throw new Error(`${entityName} not found`);
  return entity;
};

/**
 * Object-based entity validation with result object
 * 
 * Purpose: Provides an object-based interface for entity validation that
 * returns a result object instead of throwing. This is useful when you
 * want to handle the validation result programmatically rather than
 * using exception handling.
 * 
 * Design Rationale:
 * - Non-throwing: Returns result object instead of throwing
 * - Structured output: Provides both entity and boolean found flag
 * - Object interface: Accepts structured input for consistency
 * 
 * @param input - Object containing entity and entity name
 * @returns Result object with entity and found status
 */
export const throwIfNotFoundObj = <T>(input: { entity: T | null | undefined; entityName: string }) => ({ 
  entity: input.entity, 
  found: !!input.entity 
});

/**
 * Batch entity validation for multiple entities
 * 
 * Purpose: Validates multiple entities in a single operation. This function
 * currently returns the input array unchanged but is designed for future
 * enhancement where it could validate all entities and return comprehensive
 * results.
 * 
 * @param entities - Array of entity validation objects
 * @returns Input array (placeholder for future batch validation logic)
 */
export const throwIfNotFoundMany = (entities: Array<{ entity: any; entityName: string }>) => entities;

/**
 * Throw error with custom message if entity is not found
 * 
 * Purpose: Similar to throwIfNotFound but allows custom error messages
 * for more specific error reporting. This is useful when the default
 * "not found" message doesn't provide enough context.
 * 
 * @param entity - Entity to validate (can be null/undefined)
 * @param errorMessage - Custom error message to throw
 * @returns Validated non-null entity of type T
 * @throws Error with custom message when entity is null or undefined
 */
export const throwIfNotFoundWithMessage = <T>(entity: T | null | undefined, errorMessage: string): T => {
  if (!entity) throw new Error(errorMessage);
  return entity;
};

/**
 * Check if entity exists (boolean return)
 * 
 * Purpose: Provides a simple boolean check for entity existence without
 * throwing errors. This is useful when you need to conditionally handle
 * missing entities rather than failing fast.
 * 
 * @param entity - Entity to check (can be null/undefined)
 * @returns True if entity exists, false otherwise
 */
export const entityExists = <T>(entity: T | null | undefined): boolean => !!entity;

/**
 * Assert entity exists with descriptive error
 * 
 * Purpose: Similar to throwIfNotFound but uses "does not exist" wording
 * for semantic clarity in different contexts. This function provides
 * the same type safety and error handling as throwIfNotFound.
 * 
 * @param entity - Entity to validate (can be null/undefined)
 * @param entityName - Name of entity for error message context
 * @returns Validated non-null entity of type T
 * @throws Error when entity is null or undefined
 */
export const assertEntityExists = <T>(entity: T | null | undefined, entityName: string): T => {
  if (!entity) throw new Error(`${entityName} does not exist`);
  return entity;
};