# Bug Review Tasks (2026-01-06, Pass 2)

Scope: concrete runtime bugs / logic errors only (not style). Verified via a recursive `require()` sweep of `lib/**`, targeted `node --check`, and `require.resolve()` checks for missing dependencies. (Per instruction, I did not run `analyze-static-bugs .`.)

Note on CSUP: `docs/CSUP.md` recommends creating/updating `CURRENTPLAN.md`, but current session constraints request documentation changes only under `agentRecords/`, so the task list is captured here instead.

## Critical: Modules That Cannot Load (Parse / Resolve / Missing Deps)

### 1) `lib/privacyManager.js` has a syntax error
- Impact: module cannot be loaded; breaks consumers and dependent modules.
- Evidence: `node --check lib/privacyManager.js` reports `SyntaxError: Unexpected token '}'` at `lib/privacyManager.js:589` (there is a stray/unbalanced block around `lib/privacyManager.js:556`).
- Transitive breakage: `lib/breachNotificationService.js:8` imports this; `require('./lib/breachNotificationService')` fails with the same syntax error.
- Task: fix brace/method boundaries so the file parses and can be required.

### 2) `lib/standardizedResponses.js` is malformed and fails to parse
- Impact: module cannot be loaded; breaks validation layer depending on it.
- Evidence:
  - `lib/standardizedResponses.js:84` invalid regex → `SyntaxError: Invalid regular expression ... Unterminated group`.
  - The file also contains top-level statements referencing undefined `message` (`lib/standardizedResponses.js:55`) and a leading-dot call (`lib/standardizedResponses.js:96`) that will become a syntax error once the earlier regex is fixed.
- Transitive breakage: `lib/endpointValidator.js:24` imports this and fails to require.
- Task: refactor into valid exported functions, fix the regex, and ensure the module loads.

### 3) `lib/dataRetentionService.js` is corrupted and requires missing `node-cron`
- Impact: module cannot load; retention/cleanup cannot run.
- Evidence:
  - `lib/dataRetentionService.js:63` parse error (`SyntaxError: Unexpected token ':'`).
  - `lib/dataRetentionService.js:7` requires `node-cron`, but `require.resolve('node-cron')` fails (not in `package.json`).
- Task: either remove this module from the supported surface area, or repair it and add the missing dependency.

### 4) `lib/dataRetentionService_fixed.js` still cannot parse; also requires missing `node-cron`
- Impact: module cannot load; “fixed” variant is unusable.
- Evidence:
  - `lib/dataRetentionService_fixed.js:12` opens `class DataRetentionService {` but never closes it before `lib/dataRetentionService_fixed.js:107`, causing `SyntaxError: Unexpected identifier 'dataRetentionService'`.
  - `lib/dataRetentionService_fixed.js:7` requires `node-cron`, which is missing.
- Task: close the class, ensure required methods exist before auto-start, and decide whether to keep/replace cron.

### 5) `lib/distributedRateLimiter.js` cannot parse; also depends on missing Redis client(s)
- Impact: module cannot load; distributed rate limiting cannot work.
- Evidence:
  - `lib/distributedRateLimiter.js:117` declares `class BoundedFallbackCache { ... }` directly inside another class body, which is invalid syntax.
  - `require.resolve('redis')` and `require.resolve('ioredis')` both fail (not in `package.json`).
- Task: move `BoundedFallbackCache` to a valid scope and decide/add a Redis dependency (or remove Redis support).

### 6) `lib/auth.js` requires missing `bcrypt`
- Impact: module cannot load.
- Evidence: `lib/auth.js:1` requires `bcrypt`, but `require.resolve('bcrypt')` fails (not in `package.json`).
- Task: either add `bcrypt` (or compatible alternative) as a dependency, or switch to Node built-ins (e.g., `crypto.scrypt`) and remove the dependency.

### 7) `lib/shared/environmentValidator.js` has an incorrect relative import
- Impact: module cannot load.
- Evidence: `lib/shared/environmentValidator.js:3` uses `require('../config/localVars')`, but from `lib/shared/` the correct path is `../../config/localVars`.
- Task: fix the import path and add a minimal module-load test.

### 8) `lib/shared/errorHandler.js` has an incorrect relative import
- Impact: module cannot load.
- Evidence: `lib/shared/errorHandler.js:3` uses `require('./qerrors')`, but the correct path is `../qerrors`.
- Task: fix the import path and add a minimal module-load test.

## Critical: Packaging / Entrypoints

### 9) `dist/index.js` is an invalid runtime entrypoint (mixes ESM `export` with CJS `require`)
- Impact: default entrypoint (`package.json#main`) can fail at runtime depending on Node module mode.
- Evidence:
  - `dist/index.js:4` has `export default qerrors;`
  - `dist/index.js:3` has `const qerrors = require('./lib/qerrors');` which fails in ESM (`ReferenceError: require is not defined`) when running `node dist/index.js`.
- Task: pick a single module system for `dist/` and align `tsconfig.json` + `package.json` (and run a smoke test for `node dist/index.js`).

### 10) `npm run demo` likely fails under typical CJS execution
- Impact: demo script doesn’t run in a default Node CJS package.
- Evidence: `demo-server.js:17` uses ESM `import`, but `package.json` has no `"type": "module"`; script is `demo: node demo-server.js`.
- Task: convert demos to CJS, rename to `.mjs`, or declare `"type": "module"` and fix any CJS-only modules accordingly.

## Medium: Behavioral Mismatches

### 11) `lib/securityMiddleware.js` uses `express-slow-down` options that trigger a runtime warning / changed behavior
- Impact: slowdown behavior may not match intent under `express-slow-down@3`.
- Evidence: importing `lib/securityMiddleware.js` emits `ExpressSlowDownWarning` about `delayMs` semantics; see `lib/securityMiddleware.js:59-64`.
- Task: update `createSlowDown()` to match the current `express-slow-down` API (`delayMs` as a function) and add a basic test for progressive delay.

### 12) `qerrors()` sometimes returns `null`, but call sites assume it returns a Promise
- Impact: if `qerrors()` returns `null`, `qerrors(...).catch(...)` will throw a `TypeError` and can crash async contexts.
- Evidence:
  - `lib/qerrors.js:107-125` returns `null` on internal failure.
  - Example call site: `lib/securityMiddleware.js:22-34` calls `qerrors(...).catch(...)` inside `setImmediate`.
- Task: make `qerrors()` always return a Promise (resolve to `null` on internal failure), or guard all call sites (`const p = qerrors(...); p?.catch?.(...)`).
