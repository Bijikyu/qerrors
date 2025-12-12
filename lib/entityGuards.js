'use strict'; //(enable strict mode for entity guards)

/**
 * @qutils/entity-guards
 * Purpose: Generic entity validation and error throwing utilities.
 * Explanation: Provides simple, reusable functions for validating entity existence and throwing
 * descriptive errors. This is a common pattern across all applications that work with database
 * entities, eliminating boilerplate code for null checks and error handling.
 */

/**
 * @typedef {Object} ThrowIfNotFoundInput
 * @template T
 * @property {T|null|undefined} entity - The entity to validate
 * @property {string} entityName - Name of the entity for error message
 */

/**
 * @typedef {Object} ThrowIfNotFoundOutput
 * @template T
 * @property {T} entity - The validated entity
 * @property {boolean} found - Whether the entity was found
 */

/**
 * Validates entity existence and throws descriptive error if not found
 * Eliminates boilerplate null checks across database operations.
 * 
 * @template T
 * @param {T|null|undefined} entity - The entity to validate
 * @param {string} entityName - Name of the entity for error message (e.g., 'User', 'Order')
 * @returns {T} The validated entity (guaranteed non-null)
 * @throws {Error} If entity is null or undefined
 * 
 * @example
 * const user = await db.findUser(id);
 * const validUser = throwIfNotFound(user, 'User'); // throws if null
 */
const throwIfNotFound = (entity, entityName) => {
  if (!entity) throw new Error(`${entityName} not found`);
  return entity;
};

/**
 * Object-based version of throwIfNotFound with structured input/output
 * Returns found status along with entity for conditional handling.
 * 
 * @template T
 * @param {ThrowIfNotFoundInput<T>} input - Input containing entity and entityName
 * @returns {ThrowIfNotFoundOutput<T>} Object with entity and found status
 * 
 * @example
 * const result = throwIfNotFoundObj({ entity: user, entityName: 'User' });
 * if (result.found) {
 *   // use result.entity
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
 * Assert multiple entities exist, throwing on first failure
 * Useful for validating related entities in a transaction.
 * 
 * @param {Array<{entity: any, entityName: string}>} entities - Array of entities to validate
 * @returns {Array<any>} Array of validated entities
 * @throws {Error} If any entity is null or undefined
 * 
 * @example
 * const [user, order] = throwIfNotFoundMany([
 *   { entity: user, entityName: 'User' },
 *   { entity: order, entityName: 'Order' }
 * ]);
 */
const throwIfNotFoundMany = entities => entities.map(({ entity, entityName }) => throwIfNotFound(entity, entityName));

/**
 * Validate entity with custom error message
 * 
 * @template T
 * @param {T|null|undefined} entity - The entity to validate
 * @param {string} errorMessage - Custom error message to throw
 * @returns {T} The validated entity
 * @throws {Error} If entity is null or undefined
 */
const throwIfNotFoundWithMessage = (entity, errorMessage) => {
  if (!entity) throw new Error(errorMessage);
  return entity;
};

/**
 * Check if entity exists without throwing
 * 
 * @template T
 * @param {T|null|undefined} entity - The entity to check
 * @returns {boolean} True if entity exists
 */
const entityExists = entity => entity !== null && entity !== undefined;

/**
 * Assert entity exists with typed error
 * Integrates with qerrors error types for consistent error handling.
 * 
 * @template T
 * @param {T|null|undefined} entity - The entity to validate
 * @param {string} entityName - Name of the entity
 * @param {string} [errorType='NOT_FOUND'] - Error type for classification
 * @returns {T} The validated entity
 * @throws {Error} Error with type property set
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

module.exports = { throwIfNotFound, throwIfNotFoundObj, throwIfNotFoundMany, throwIfNotFoundWithMessage, entityExists, assertEntityExists };
