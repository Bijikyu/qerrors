// TypeScript ESM wrapper to expose named exports for CommonJS module
// Ensures dynamic imports in tests see an object with named exports
import * as testUtils from './testUtils.js';

export const QerrorsTestEnv = (testUtils as any).QerrorsTestEnv;
export const QerrorsStubbing = (testUtils as any).QerrorsStubbing;
export const createMockResponse = (testUtils as any).createMockResponse;
export const createMockRequest = (testUtils as any).createMockRequest;
export const runQerrorsIntegrationTest = (testUtils as any).runQerrorsIntegrationTest;
export const withOfflineMode = (testUtils as any).withOfflineMode;
export const qtests = (testUtils as any).qtests;

export default testUtils as any;

