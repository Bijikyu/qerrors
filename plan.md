# QErrors Demo Comprehensive Overhaul Plan

## Objective
Replace all mock data and simulated responses in the demo with real qerrors library functionality, covering 100% of the module's capabilities.

---

## Current State Analysis

### Module Exports (69 functions + sub-modules)
The qerrors module exports functionality across these categories:

| Category | Functions | Count |
|----------|-----------|-------|
| Core Error Handling | `middleware`, `errorMiddleware`, `handleSimpleError`, `globalErrorHandler` | 4 |
| Error Creation | `createTypedError`, `createStandardError`, `ServiceError`, `generateErrorId` | 4 |
| Context Extraction | `extractContext` | 1 |
| Logging | `logDebug`, `logInfo`, `logWarn`, `logError`, `logFatal`, `logAudit`, `createSimpleWinstonLogger` | 7 |
| Sanitization | `sanitizeMessage`, `sanitizeContext` | 2 |
| Queue Management | `getQueueStats`, `getQueueRejectCount`, `createLimiter`, `startQueueMetrics`, `stopQueueMetrics` | 5 |
| AI Model Manager | `getAIModelManager`, `resetAIModelManager` | 2 |
| Config/Environment | `getEnv`, `getInt`, `getMissingEnvVars`, `validateRequiredEnvVars`, `warnMissingEnvVars`, `throwIfMissingEnvVars` | 6 |
| Entity Guards | `throwIfNotFound`, `throwIfNotFoundObj`, `throwIfNotFoundMany`, `entityExists`, `assertEntityExists` | 5 |
| Response Helpers | `sendJsonResponse`, `sendSuccessResponse`, `sendCreatedResponse`, `sendErrorResponse`, `sendValidationErrorResponse`, `sendNotFoundResponse`, `sendUnauthorizedResponse`, `sendForbiddenResponse`, `sendServerErrorResponse`, `createResponseHelper` | 10 |
| Utils | `safeRun`, `createTimer`, `attempt`, `executeWithQerrors`, `formatErrorMessage`, `generateUniqueId`, `verboseLog` | 7 |
| Dependency Injection | `createQerrorsCoreDeps`, `getDefaultQerrorsCoreDeps`, `createDefaultErrorHandlingDeps`, `qerr`, `getErrorSeverity`, `logErrorWithSeverityDI`, `withErrorHandlingDI` | 7 |
| Module Initialization | `initializeModule`, `initializeModuleESM`, `shouldInitialize`, `logModuleInit` | 4 |
| Circuit Breaker | `createCircuitBreaker` (from lib/circuitBreaker.js) | 1 |

### Current Demo State
- 29 functions using `simulateAsyncOperation` (mock delays)
- API endpoints return hardcoded/mock data
- AI analysis returns pre-written responses (not using Gemini)
- Circuit breaker is simulated, not real
- Logging functions not demonstrated
- Sanitization not demonstrated
- Entity guards not demonstrated
- Response helpers not demonstrated

---

## Implementation Plan

### Phase 1: Backend API Overhaul (demo-server.js)

#### 1.1 Core Setup
- [ ] Import all qerrors modules properly
- [ ] Initialize real AI model manager with Gemini
- [ ] Set up real circuit breaker instance
- [ ] Start queue metrics collection

#### 1.2 Replace Mock API Endpoints

| Endpoint | Current | Target |
|----------|---------|--------|
| `POST /api/errors/trigger` | Mock error data | Real `createTypedError`, `extractContext`, `logError` |
| `POST /api/errors/custom` | Mock custom error | Real `ServiceError`, custom error classes |
| `POST /api/errors/analyze` | Mock AI response | Real `getAIModelManager().analyzeError()` with Gemini |
| `GET /api/metrics` | Partial real | Full `getQueueStats`, `getQueueRejectCount` |
| `GET /api/logs/export` | Mock logs | Real log entries from logger |
| `GET /api/circuit/status` | Mock state | Real circuit breaker state |
| `POST /api/circuit/test` | Mock transitions | Real circuit breaker operations |

#### 1.3 Add New API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/logging/test` | Demonstrate all log levels |
| `POST /api/sanitization/test` | Demonstrate message/context sanitization |
| `POST /api/entity-guards/test` | Demonstrate throwIfNotFound, entityExists |
| `POST /api/response-helpers/test` | Demonstrate all response helper functions |
| `POST /api/utils/safe-run` | Demonstrate safeRun with error recovery |
| `POST /api/utils/timer` | Demonstrate createTimer for performance |
| `POST /api/utils/attempt` | Demonstrate retry logic with attempt |
| `POST /api/config/validate` | Demonstrate env validation functions |
| `GET /api/queue/stats` | Dedicated queue statistics endpoint |
| `POST /api/queue/limiter` | Demonstrate rate limiting with createLimiter |

---

### Phase 2: Frontend UI Restructure (demo.html)

#### 2.1 Reorganize UI Sections
Current sections to keep (with real functionality):
- Error Testing (Basic, Custom, AI Analysis)
- System Metrics
- Circuit Breaker

New sections to add:
- **Logging Demo** - Test all log levels, view output
- **Sanitization Demo** - Input sanitization testing
- **Queue Management** - Rate limiting, queue stats
- **Entity Guards** - Not-found handling demo
- **Response Helpers** - HTTP response generation demo
- **Utility Functions** - safeRun, timer, attempt demos
- **Config/Environment** - Env validation demo

#### 2.2 Remove Mock Functions
Replace all `simulateAsyncOperation()` calls with real API calls:
- `validateEnvironment()` → Real API call
- `testEnvironmentHealth()` → Real API call  
- `testExpressMiddleware()` → Real API call
- `testCircuitBreaker()` → Real circuit breaker
- All other mock functions

#### 2.3 Update Response Handling
- Show real server responses
- Display actual error IDs from library
- Show real AI analysis from Gemini
- Display actual queue metrics

---

### Phase 3: Real AI Integration

#### 3.1 Configure Gemini
- Gemini API key already configured (`GEMINI_API_KEY`)
- Provider set to `google` (`QERRORS_AI_PROVIDER`)
- Model: `gemini-2.5-flash-lite` (`QERRORS_AI_MODEL`)

#### 3.2 AI Analysis Endpoint
- Call `getAIModelManager().analyzeError(errorData)`
- Return real AI-generated analysis
- Include confidence scores, suggestions
- Handle rate limiting gracefully

---

### Phase 4: Testing & Validation

#### 4.1 Functional Testing
- [ ] All buttons trigger real API calls
- [ ] All responses contain real data
- [ ] AI analysis returns Gemini responses
- [ ] Circuit breaker state changes work
- [ ] Queue metrics update in real-time
- [ ] Logging output visible in server logs

#### 4.2 Error Handling
- [ ] API errors display properly in UI
- [ ] Rate limiting feedback shown
- [ ] Circuit breaker open state handled

---

## File Changes Summary

| File | Action |
|------|--------|
| `demo/demo-server.js` | Major rewrite - real qerrors integration |
| `demo/demo.html` | Restructure UI, remove mocks, add new sections |
| `demo/demo.css` | Add styles for new sections (if needed) |

---

## Estimated Scope
- **Backend changes**: ~300 lines modified/added
- **Frontend changes**: ~500 lines modified (removing mocks, adding real calls)
- **New UI sections**: 6-8 new demonstration panels

---

## Success Criteria
1. Zero `simulateAsyncOperation` calls remaining
2. Zero hardcoded mock responses in API
3. AI analysis uses real Gemini API
4. All 69 module functions have UI demonstration
5. Real-time metrics from actual library operations
6. All circuit breaker states testable via real breaker
