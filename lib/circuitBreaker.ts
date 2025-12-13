// Placeholder for circuit breaker
export const CircuitBreaker = class {};
export const CircuitState = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
export const createCircuitBreaker = () => new CircuitBreaker();