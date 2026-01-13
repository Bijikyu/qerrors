// Placeholder for circuit breaker implementation
// NOTE: This module provides a minimal stub for a circuit breaker pattern. In a full
// implementation, the CircuitBreaker class would track failure counts, open/close
// states, and enforce a timeout before allowing calls to resume. The stub is kept
// simple to avoid external dependencies and to keep the library functional when
// AI services are optional.
// Export a class that would normally encapsulate circuit breaker logic. Here it
// is an empty class acting as a placeholder.
export const CircuitBreaker = class {
};
// Enumerate possible circuit breaker states. Keeping these constants allows other
// parts of the codebase to reference states without hard‑coding strings.
export const CircuitState = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
// Factory function to create a new CircuitBreaker instance. In a real version it
// would accept configuration such as failure thresholds and timeout durations.
export const createCircuitBreaker = () => new CircuitBreaker();
//# sourceMappingURL=circuitBreaker.js.map