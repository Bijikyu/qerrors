'use strict';

/**
 * Entity Guards Module - Comprehensive Entity Validation and Error Handling
 * 
 * Purpose: Provides a suite of utility functions for validating entity existence
 * and throwing descriptive errors when entities are not found. This module
 * standardizes entity validation patterns across the application, ensuring
 * consistent error messages and handling for missing entities.
 * 
 * Design Rationale:
 * - Consistent error messaging: Standardizes "not found" error formats
 * - Flexible validation patterns: Supports different validation approaches
 * - Type safety: Provides typed error information for better error handling
 * - Batch validation: Enables validation of multiple entities simultaneously
 * - Defensive programming: Prevents null/undefined errors in downstream code
 * - Developer experience: Clear, descriptive error messages for debugging
 * 
 * Key Features:
 * - Single entity validation with automatic error throwing
 * - Object-based validation that returns results instead of throwing
 * - Batch validation for multiple entities at once
 * - Custom error message support for specific validation scenarios
 * - Type-safe error creation with error type classification
 * - Non-throwing existence checks for conditional logic
 * 
 * Common Use Cases:
 * - Database query result validation
 * - API response entity verification
 * - Cache hit validation
 * - Configuration entity checking
 * - Resource existence verification before operations
 */

/**
 * Validate entity exists or throw descriptive error
 * 
 * This is the most commonly used guard function. It checks if an entity
 * exists (is not null or undefined) and throws a descriptive error if
 * it doesn't. This is ideal for use-cases where the entity must exist
 * for the operation to continue, such as when retrieving a user by ID
 * from a database.
 * 
 * @param {*} entity - Entity to validate (can be any value)
 * @param {string} entityName - Descriptive name of the entity for error messages
 * @returns {*} The validated entity (unchanged if it exists)
 * @throws {Error} If entity is null or undefined
 * 
 * Example:
 * const user = await getUserById(userId);
 * const validatedUser = throwIfNotFound(user, 'User');
 * // Throws: "User not found" if user is null/undefined
 * // Returns: user object if it exists
 */
const throwIfNotFound = (entity, entityName) => {
  if (!entity) {
    throw new Error(`${entityName} not found`);
  }
  return entity;
};

/**
 * Validate entity existence and return result object instead of throwing
 * 
 * This function provides a non-throwing alternative to throwIfNotFound.
 * It returns a result object indicating whether the entity was found and
 * includes the entity if it exists. This is useful when you need to
 * handle missing entities gracefully without throwing errors.
 * 
 * @param {Object} input - Input object containing entity and entityName
 * @param {*} input.entity - Entity to validate
 * @param {string} input.entityName - Descriptive name of the entity
 * @returns {Object} Result object with found status and entity
 * @returns {boolean} returns.found - Whether the entity was found
 * @returns {*} returns.entity - The entity if found, null otherwise
 * 
 * Example:
 * const result = throwIfNotFoundObj({
 *   entity: await getUserById(userId),
 *   entityName: 'User'
 * });
 * 
 * if (result.found) {
 *   console.log('User found:', result.entity);
 * } else {
 *   console.log('User not found, using fallback');
 * }
 */
const throwIfNotFoundObj = input => {
  try {
    const entity = throwIfNotFound(input.entity, input.entityName);
    return { entity, found: true };
  } catch (error) {
    return { entity: null, found: false };
  }
};

/**
 * Validate multiple entities exist simultaneously
 * 
 * This function validates an array of entities, throwing an error for the
 * first entity that is not found. This is useful when you need to validate
 * that multiple dependent entities all exist before proceeding with an
 * operation that requires all of them.
 * 
 * @param {Array<Object>} entities - Array of objects containing entity and entityName
 * @param {Array<*>} entities[].entity - Entity to validate
 * @param {Array<string>} entities[].entityName - Descriptive name of the entity
 * @returns {Array<*>} Array of validated entities (in same order as input)
 * @throws {Error} If any entity is not found (error mentions first missing entity)
 * 
 * Example:
 * const entities = [
 *   { entity: await getUserById(userId), entityName: 'User' },
 *   { entity: await getAccountById(accountId), entityName: 'Account' },
 *   { entity: await getProfileById(profileId), entityName: 'Profile' }
 * ];
 * 
 * const [user, account, profile] = throwIfNotFoundMany(entities);
 * // All entities are guaranteed to exist if no error was thrown
 */
const throwIfNotFoundMany = entities => {
  return entities.map(({ entity, entityName }) => {
    return throwIfNotFound(entity, entityName);
  });
};

/**
 * Validate entity exists with custom error message
 * 
 * This function provides the same validation as throwIfNotFound but allows
 * for a custom error message. This is useful when you need more specific
 * error messages that include additional context or instructions for the
 * consumer of the error.
 * 
 * @param {*} entity - Entity to validate
 * @param {string} errorMessage - Custom error message to throw if entity is not found
 * @returns {*} The validated entity (unchanged if it exists)
 * @throws {Error} With the provided custom error message if entity is null/undefined
 * 
 * Example:
 * const user = await getUserById(userId);
 * throwIfNotFoundWithMessage(user, `User with ID ${userId} not found. Please check the ID and try again.`);
 * 
 * // Or for more complex validation:
 * const product = await getProductById(productId);
 * throwIfNotFoundWithMessage(
 *   product, 
 *   `Product ${productId} is not available in your region. Available products: ${availableProductIds.join(', ')}`
 * );
 */
const throwIfNotFoundWithMessage = (entity, errorMessage) => {
  if (!entity) {
    throw new Error(errorMessage);
  }
  return entity;
};

/**
 * Check if entity exists without throwing any errors
 * 
 * This function provides a simple boolean check for entity existence
 * without any error throwing. It's useful for conditional logic where
 * you need to know if an entity exists but don't want to throw errors
 * when it doesn't.
 * 
 * @param {*} entity - Entity to check
 * @returns {boolean} True if entity exists (not null or undefined), false otherwise
 * 
 * Example:
 * const user = await getUserById(userId);
 * if (entityExists(user)) {
 *   console.log('User exists, proceeding with operation');
 *   // ... do something with user
 * } else {
 *   console.log('User does not exist, skipping operation');
 * }
 * 
 * // Or for conditional rendering:
 * const showAdminPanel = entityExists(currentUser) && currentUser.isAdmin;
 */
const entityExists = entity => entity !== null && entity !== undefined;

/**
 * Assert entity exists with typed error information
 * 
 * This function provides enhanced error creation with type classification
 * for better error handling and response generation. It creates an error
 * object with additional metadata that can be used by error handling
 * middleware to generate appropriate HTTP responses.
 * 
 * @param {*} entity - Entity to validate
 * @param {string} entityName - Descriptive name of the entity
 * @param {string} [errorType='NOT_FOUND'] - Error type classification for response handling
 * @returns {*} The validated entity (unchanged if it exists)
 * @throws {Error} Enhanced error with type and entity metadata if entity is not found
 * 
 * Example:
 * try {
 *   const user = assertEntityExists(
 *     await getUserById(userId), 
 *     'User', 
 *     'USER_NOT_FOUND'
 *   );
 *   // ... proceed with user
 * } catch (error) {
 *   if (error.type === 'USER_NOT_FOUND') {
 *     // Handle specific user not found error
 *     res.status(404).json({ error: 'User not found', entityId: error.entityName });
 *   }
 * }
 */
const assertEntityExists = (entity, entityName, errorType = 'NOT_FOUND') => {
  if (!entity) {
    const error = new Error(`${entityName} not found`);
    error.type = errorType;
    error.entityName = entityName;
    throw error;
  }
  return entity;
};

// Export all validation functions for use in other modules
module.exports = {
  // Basic validation functions
  throwIfNotFound,
  throwIfNotFoundObj,
  throwIfNotFoundMany,
  throwIfNotFoundWithMessage,
  
  // Utility functions
  entityExists,
  assertEntityExists
};