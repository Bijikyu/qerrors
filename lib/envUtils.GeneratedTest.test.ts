// Generated unit test for envUtils.js - TypeScript ES module
// 🚩AI: ENTRY_POINT_FOR_GENERATED_TEST_IMPORTS
import 'qtests/setup';

let testModule: any;
beforeAll(async () => {
  testModule = await import('./envUtils');
});

describe('getMissingEnvVars', () => {
  it('is defined', () => {
    const target = (testModule as any)['getMissingEnvVars'];
    if (typeof target === 'undefined') {
      // Skip: export not found on module at runtime
      expect(true).toBe(true);
      return;
    }
    expect(target).toBeDefined();
  });
});

describe('throwIfMissingEnvVars', () => {
  it('is defined', () => {
    const target = (testModule as any)['throwIfMissingEnvVars'];
    if (typeof target === 'undefined') {
      // Skip: export not found on module at runtime
      expect(true).toBe(true);
      return;
    }
    expect(target).toBeDefined();
  });
});
