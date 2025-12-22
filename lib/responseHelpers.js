'use strict';

/**
 * Response Helpers Module - Backward Compatibility Layer
 * 
 * Purpose: Provides backward compatibility for existing code that imports
 * response helpers from this location. This module re-exports all functionality
 * from the unified shared/response module, ensuring that existing imports
 * continue to work without modification while the codebase transitions to
 * the new modular structure.
 * 
 * Design Rationale:
 * - Backward Compatibility: Existing imports continue to work without changes
 * - Migration Path: Allows gradual migration to new module structure
 * - Code Organization: Centralizes response utilities in shared module
 * - API Consistency: Maintains the same interface for all consumers
 * 
 * Migration Strategy:
 * - Phase 1: This module provides compatibility during refactoring
 * - Phase 2: New code should import directly from shared/response
 * - Phase 3: Existing imports can be gradually updated to new location
 * - Phase 4: This compatibility layer can be removed once migration is complete
 * 
 * Usage Examples:
 * // Legacy imports (still work):
 * const responseHelpers = require('./responseHelpers');
 * 
 * // New imports (recommended):
 * const responseHelpers = require('./shared/response');
 * 
 * // Both provide identical functionality
 */

// Re-export all functionality from the unified response module
// This ensures that existing code continues to work without modification
// while providing access to all response helper utilities
module.exports = require('./shared/response');