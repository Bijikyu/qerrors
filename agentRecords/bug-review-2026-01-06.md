# Bug Review Tasks (2026-01-06)

Scope: identify concrete runtime bugs / logic errors (not style). Commands run: `npm test`, `npm run test:integration` (failed).

Note on CSUP: `docs/CSUP.md` recommends creating/updating `CURRENTPLAN.md`, but current session constraints request documentation changes only under `agentRecords/`, so the task list is captured here instead.

## High Priority (Crashes / Broken Contracts)

### 1) Express error middleware calls `next()` after responding
- Impact: can trigger “headers already sent” and double-handling; violates Express error-middleware contract.
- Evidence: `lib/qerrors.js:132` returns middleware that always calls `next()` in `.finally()` (`lib/qerrors.js:159-163`) even after `sendHtmlError()` / `sendJsonError()` writes a response (`lib/qerrors.js:148-154`).
- Fix task:
  - Only call `next(err)` if delegating to downstream error handlers; otherwise do not call `next()` after sending a response.
  - Ensure no response is written twice; respect `res.headersSent`.

### 2) `sendHtmlError()` / `sendJsonError()` assume `analysis` is non-null
- Impact: if upstream returns `null` (or throws and is caught), these functions will throw `TypeError: Cannot read properties of null`.
- Evidence:
  - `sendHtmlError()` reads `analysis.errorId` (`lib/qerrors.js:190`).
  - `sendJsonError()` reads `analysis.errorId` (`lib/qerrors.js:205`).
- Fix task:
  - Treat `analysis` as optional: `analysis?.errorId` (or default object), and always produce a safe response.

### 3) `qerrors(error, location, context)` forwards wrong arguments to `ScalableErrorHandler.handleError()`
- Impact: location and context are not recorded correctly; context becomes a string (location), and the real context object is ignored.
- Evidence:
  - Call site passes 3 args (`lib/qerrors.js:111`), but handler signature is `handleError(error, context = {})` (`lib/scalabilityFixes.js:561`).
  - `sanitizeContext()` iterates `Object.entries(context)` (`lib/scalabilityFixes.js:665`), so a string context turns into `{ "0": "...", ... }`.
- Fix task:
  - Decide on one public contract:
    - Option A: change `qerrors()` to call `handleError(error, { location, ...context })`.
    - Option B: change `handleError()` to accept `(error, location, context)` and update all call sites.
  - Update tests to cover the contract.

### 4) `lib/qerrorsQueue.js` has multiple guaranteed runtime errors
- Impact: queue scheduling path will throw before doing work.
- Evidence:
  - `getFullErrorFromCache()` references `signature` which is not defined (`lib/qerrorsQueue.js:149-153`).
  - `memoryMonitor` is referenced but never defined/imported (`lib/qerrorsQueue.js:227`, `lib/qerrorsQueue.js:283`, `lib/qerrorsQueue.js:333`).
  - `setAdviceInCache(...).catch(...)` assumes a Promise return; `setAdviceInCache` is synchronous, so this throws immediately (`lib/qerrorsQueue.js:275-277`).
- Fix task:
  - Fix `getFullErrorFromCache(signatureId)` to not reference an undefined `signature` (either pass the signature in, or return a minimal reconstructed error without `signature` fields).
  - Replace `memoryMonitor.checkMemoryUsage()` with the actual exported API from `lib/shared/memoryMonitor.js` (e.g., use `getCurrentMemoryPressure().level` or import `memoryMonitor` and call supported methods).
  - Remove `.catch` on `setAdviceInCache` call; wrap in `try/catch` if needed.

### 5) `lib/qerrorsCache.js` uses undefined identifiers and non-existent cache APIs
- Impact: cache cleanup/auto-tuning will throw at runtime; stop/cleanup likely leaks intervals.
- Evidence:
  - `memoryMonitor` is never defined/imported but used in `startAdviceCleanup()` and `setAdviceInCache()` and `getCacheStats()` (`lib/qerrorsCache.js:77`, `lib/qerrorsCache.js:193`, `lib/qerrorsCache.js:226-227`).
  - `cachedMemoryPressure` is referenced but never defined (`lib/qerrorsCache.js:79`).
  - `adjustCacheSize()` uses `memoryPressure` which is not in scope (`lib/qerrorsCache.js:132-135`); it computes `memoryInfo` but never uses it (`lib/qerrorsCache.js:124`).
  - `stopAdviceCleanup()` clears `timerHandles.*`, but the active intervals are stored in `cleanupHandle`/`autoTuningHandle` (`lib/qerrorsCache.js:71-96`, `lib/qerrorsCache.js:99-106`) so clearing no-ops; intervals can remain active.
  - `adviceCache.findOldestKey()` is not a method of `lru-cache` (`lib/qerrorsCache.js:211`), so this branch throws when executed.
- Fix task:
  - Import the correct memory monitor singleton from `lib/shared/memoryMonitor.js` and use its actual methods.
  - Remove/replace `cachedMemoryPressure` with real state tracking if needed.
  - Fix `stopAdviceCleanup()` to clear the real interval handles that were created.
  - Replace `findOldestKey()` usage with a valid eviction approach (e.g., `adviceCache.keys().next().value` or maintain your own “oldest key” tracking) consistent with `lru-cache@10`.

### 6) `config.getBool` is used but not implemented
- Impact: `TypeError: config.getBool is not a function`.
- Evidence:
  - `lib/config.js` exports no `getBool` (`lib/config.js:78-87`).
  - `lib/qerrorsHttpClient.js` calls it in a path that rethrows errors, breaking outbound requests (`lib/qerrorsHttpClient.js:631`).
  - `lib/qerrorsAnalysis.js` calls it but catches errors in the cache-key generation block (`lib/qerrorsAnalysis.js:150-154`).
- Fix task:
  - Add `getBool(name, defaultVal)` to `lib/config.js`, or replace `getBool` call sites with explicit parsing (and remove the call).
  - Ensure `executeRequestWithRetry()` works when the env var is unset or malformed.

### 7) `queueManager.logQueueMetrics` treats `require('./logger')` as a Promise
- Impact: queue metrics logging path always errors and falls back; metrics likely never reach the configured logger.
- Evidence: `require('./logger').then(...)` (`lib/queueManager.js:146`) but `lib/logger.js` exports a logger object (not a Promise).
- Fix task:
  - Replace `.then(...)` usage with direct logger usage (still keep try/catch and console fallback).

## Medium Priority (Wrong Behavior / Degraded Functionality)

### 8) Adaptive socket pool load averaging logic is internally inconsistent
- Impact: socket scaling decisions likely wrong; average load can drift incorrectly because `runningSum` is not updated when `loadHistory` is mutated in `updateLoad()`.
- Evidence:
  - `addLoadMeasurement()` maintains `runningSum` (`lib/qerrorsHttpClient.js:64-75`) but is never used by the periodic adjustment loop.
  - `updateLoad()` mutates `loadHistory` without updating `runningSum` (`lib/qerrorsHttpClient.js:77-84`), and uses the current average as the next sample (`lib/qerrorsHttpClient.js:78-80`), which can self-dampen.
- Fix task:
  - Decide on a single implementation (either always update via `addLoadMeasurement`, or keep `runningSum` consistent on every push/shift).
  - Add a minimal unit test for expected average/scale behavior.

## Test Infrastructure Bugs

### 9) `npm run test:integration` cannot run as configured
- Impact: current integration test script fails immediately.
- Evidence:
  - Script runs `node test/integration.test.js`, but the file uses `describe`, `beforeEach`, `test`, `expect`, and `jest.fn()` without providing a runner (`test/integration.test.js:3`, `test/integration.test.js:17-23`).
  - Actual failure observed: `ReferenceError: describe is not defined`.
- Fix task:
  - Pick one test framework and wire it correctly (e.g., add Jest and run via `jest`, or convert to Node’s built-in `node:test` API).
  - Remove mixed framework globals (currently a hybrid of Jest + Mocha-style).

## Implementation Status (This Session)

Completed fixes (all covered by `npm test`, `npm run test:integration`, and `npm run build`):
- Fixed Express middleware double-handling and null-safe `analysis` access (`lib/qerrors.js`).
- Fixed `qerrors(error, location, context)` context propagation into handler (`lib/qerrors.js`).
- Fixed queue signature reconstruction, removed invalid Promise usage, and corrected memory-pressure reads (`lib/qerrorsQueue.js`).
- Fixed cache memory-monitor integration, timer cleanup, and invalid LRU eviction API usage (`lib/qerrorsCache.js`).
- Added missing `config.getBool()` used across modules (`lib/config.js`).
- Fixed queue metrics logger usage (removed `.then` on `require('./logger')`) (`lib/queueManager.js`).
- Fixed adaptive socket pool load measurement to track real active requests and keep running average consistent (`lib/qerrorsHttpClient.js`).
- Converted integration test to Node built-in runner (`node:test`) to match `npm`-only constraints (`test/integration.test.js`).
- Prevented test hang by `unref()`-ing the `ScalableErrorHandler` memory interval (`lib/scalabilityFixes.js`).

### Follow-up fixes after reviewing my changes
- Restored Promise-safe logger usage in queue metrics (the logger export is a Promise from `async buildLogger()`) (`lib/queueManager.js`).
- Fixed `config.getBool()` to correctly parse string defaults like `"false"` (previously `Boolean("false") === true`) (`lib/config.js`).
- Made cache TTL adapt to memory pressure even when cache size does not change (`lib/qerrorsCache.js`).
- Prevented `context.location` from overriding the explicit `location` parameter (`lib/qerrors.js`).
