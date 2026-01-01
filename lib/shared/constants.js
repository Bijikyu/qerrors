'use strict';
/**
 * Shared Constants Module
 * 
 * Purpose: Centralizes and re-exports critical constants used across
 * qerrors module and shared utilities. This module provides a
 * single source of truth for HTTP status codes, default messages,
 * and logging levels.
 * 
 * Design Rationale:
 * - Centralized constants management from localVars
 * - Single import point for commonly used constants
 * - Maintains consistency across all modules
 * - Reduces circular dependency issues
 * - Provides clean separation between configuration and usage
 * 
 * Constants Provided:
 * - HTTP_STATUS: Standard HTTP status code mappings
 * - DEFAULT_MESSAGES: Commonly used message templates
 * - LOG_LEVELS: Logging level definitions and priorities
 */
const localVars=require('../../config/localVars'),{HTTP_STATUS,DEFAULT_MESSAGES,LOG_LEVELS}=localVars;
/**
 * Exported constants for shared module usage
 * 
 * These constants are imported from central localVars configuration
 * and made available to all shared modules. This ensures consistency
 * and prevents hardcoding of values throughout the codebase.
 * 
 * Usage Pattern:
 * - Import constants from this module rather than localVars directly
 * - Provides stable interface for shared modules
 * - Allows for easy modification and centralized management
 */
module.exports={HTTP_STATUS,DEFAULT_MESSAGES,LOG_LEVELS};