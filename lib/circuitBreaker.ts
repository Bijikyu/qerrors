// @ts-ignore - opossum types may not be available
import * as opossum from 'opossum';
const { logError } = require('./shared/errorWrapper');

export interface CircuitBreakerOptions {
  timeoutMs?: number;
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  monitoringPeriodMs?: number;
  serviceName?: string;
}

export interface CircuitBreakerExecuteResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  circuitState: string;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker<T = any> {
  private breaker: opossum.CircuitBreaker<T>;
  private serviceName: string;

  constructor(operation: (...args: any[]) => Promise<T>, options: CircuitBreakerOptions = {}) {
    if (!options || (options.failureThreshold !== undefined && options.failureThreshold <= 0)) {
      throw new Error('failureThreshold must be positive');
    }
    if (options.recoveryTimeoutMs !== undefined && options.recoveryTimeoutMs <= 0) {
      throw new Error('recoveryTimeoutMs must be positive');
    }

    this.serviceName = options.serviceName || 'unknown';

    const opossumOptions: opossum.CircuitBreakerOptions = {
      timeout: options.timeoutMs || 10000,
      errorThreshold: options.failureThreshold || 5,
      resetTimeout: options.recoveryTimeoutMs || 60000,
      rollingCountTimeout: options.monitoringPeriodMs || 60000,
      rollingCountBuckets: 10,
      cacheEnabled: false,
      enabled: true
    };

    this.breaker = new opossum.CircuitBreaker(operation, opossumOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.breaker.on('open', () => {
      try {
        logError(new Error('Circuit breaker opened'), 'circuitBreaker.open', {
          operation: 'circuit_breaker_state_transition',
          serviceName: this.serviceName,
          fromState: 'CLOSED_OR_HALF_OPEN',
          toState: 'OPEN'
        });
      } catch (error) {
        console.error('Circuit breaker open logging error:', (error as Error).message);
      }
      console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to OPEN`);
    });

    this.breaker.on('halfOpen', () => {
      try {
        logError(new Error('Circuit breaker half-opened'), 'circuitBreaker.halfOpen', {
          operation: 'circuit_breaker_state_transition',
          serviceName: this.serviceName,
          fromState: 'OPEN',
          toState: 'HALF_OPEN'
        });
      } catch (error) {
        console.error('Circuit breaker half-open logging error:', (error as Error).message);
      }
      console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to HALF_OPEN`);
    });

    this.breaker.on('close', () => {
      try {
        logError(new Error('Circuit breaker closed'), 'circuitBreaker.close', {
          operation: 'circuit_breaker_state_transition',
          serviceName: this.serviceName,
          fromState: 'OPEN_OR_HALF_OPEN',
          toState: 'CLOSED'
        });
      } catch (error) {
        console.error('Circuit breaker close logging error:', (error as Error).message);
      }
      console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to CLOSED`);
    });

    this.breaker.on('failure', (result: T, error: Error) => {
      try {
        logError(error, 'circuitBreaker.failure', {
          operation: 'circuit_breaker_failure',
          serviceName: this.serviceName,
          hasResult: !!result,
          errorMessage: error?.message
        });
      } catch (qerror) {
        console.error('qerrors logging failed in circuit breaker failure:', (qerror as Error).message);
      }
    });
  }

  async execute(...args: any[]): Promise<CircuitBreakerExecuteResult<T>> {
    try {
      const result = await this.breaker.fire(...args);
      return {
        success: true,
        data: result,
        circuitState: this.breaker.status?.state || CircuitState.CLOSED
      };
    } catch (error) {
      try {
        logError(error as Error, 'circuitBreaker.execute', {
          operation: 'circuit_breaker_execute',
          serviceName: this.serviceName,
          circuitState: this.breaker.status?.state || CircuitState.CLOSED
        });
      } catch (qerror) {
        console.error('qerrors logging failed in circuit breaker execute:', (qerror as Error).message);
      }
      return {
        success: false,
        error: error as Error,
        circuitState: this.breaker.status?.state || CircuitState.CLOSED
      };
    }
  }

  getStatus(): any {
    return this.breaker.stats;
  }

  getState(): string {
    return (this.breaker as any).status?.state || CircuitState.CLOSED;
  }

  isOpen(): boolean {
    return (this.breaker as any).opened();
  }

  close(): void {
    (this.breaker as any).close();
  }

  open(): void {
    (this.breaker as any).open();
  }

  purgeCache(): void {
    (this.breaker as any).purgeCache();
  }

  forceClose(): void {
    (this.breaker as any).forceClose();
  }

  forceOpen(): void {
    (this.breaker as any).forceOpen();
  }
}

export function createCircuitBreaker<T = any>(
  operation: (...args: any[]) => Promise<T>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<T> {
  return new CircuitBreaker<T>(operation, options);
}