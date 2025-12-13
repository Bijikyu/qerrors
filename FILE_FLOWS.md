# FILE_FLOWS
> Auto-generated. Do not edit directly.
> Files grouped by PRIMARY: actual data flow relationships, SECONDARY: filename similarity.

### 🧩 Flow Group: `Entry-Point`

## [1] `index.js`
**Type:** Module Entry Point
**Exports:** qerrors, logger, errorTypes, sanitization, queueManager, utils, config, envUtils, aiModelManager, moduleInitializer, dependencyInterfaces, entityGuards, responseHelpers, circuitBreaker
**Summary:** Main entry point for the qerrors npm package - exports all public APIs

---

### 🧩 Flow Group: `Core-Error-Handling`

## [2] `lib/qerrors.js`
**Type:** Core Implementation
**Dependencies:** config, errorTypes, p-limit, logger, axios, crypto, escape-html, lru-cache, aiModelManager, shared/*
**Exports:** qerrors, analyzeError, postWithRetry, queue management functions
**Summary:** Main qerrors middleware implementation with AI-powered error analysis

## [3] `lib/errorTypes.js`
**Type:** Error Type Definitions
**Dependencies:** responseHelpers
**Exports:** createTypedError, createStandardError, ErrorTypes, ErrorSeverity, ErrorFactory, errorMiddleware
**Summary:** Standardized error type definitions and error creation utilities

## [4] `lib/responseHelpers.js`
**Type:** Response Utilities
**Dependencies:** sanitization
**Exports:** sendSuccessResponse, sendErrorResponse, sendValidationErrorResponse
**Summary:** Standardized response formatting utilities for Express.js

---

### 🧩 Flow Group: `Configuration-Environment`

## [5] `lib/config.js`
**Type:** Configuration Management
**Dependencies:** dotenv
**Exports:** defaults, getEnv, safeRun, getInt, validateRequiredVars, getConfigSummary
**Summary:** Environment variable management and configuration defaults

## [6] `lib/envUtils.js`
**Type:** Environment Utilities
**Dependencies:** config
**Exports:** getMissingEnvVars, throwIfMissingEnvVars, warnIfMissingEnvVars, validateRequiredEnvVars
**Summary:** Environment variable validation and error handling utilities

---

### 🧩 Flow Group: `Logging-System`

## [7] `lib/logger.js`
**Type:** Logging Implementation
**Dependencies:** winston, winston-daily-rotate-file, config
**Exports:** logDebug, logInfo, logWarn, logError, logFatal, logAudit, createPerformanceTimer, createEnhancedLogEntry
**Summary:** Winston-based logging system with daily rotation and performance monitoring

## [8] `lib/shared/logging.js`
**Type:** Shared Logging Utilities
**Dependencies:** None
**Exports:** stringifyContext, verboseLog, safeErrorMessage
**Summary:** Common logging utilities used across modules

---

### 🧩 Flow Group: `Security-Sanitization`

## [9] `lib/sanitization.js`
**Type:** Input Sanitization
**Dependencies:** None
**Exports:** sanitizeMessage, sanitizeContext, addCustomSanitizationPattern, clearCustomSanitizationPatterns
**Summary:** Input sanitization utilities for security and PII protection

---

### 🧩 Flow Group: `Queue-Management`

## [10] `lib/queueManager.js`
**Type:** Queue Implementation
**Dependencies:** denque
**Exports:** createLimiter, getQueueLength, getQueueRejectCount, startQueueMetrics, stopQueueMetrics
**Summary:** Queue management system for AI analysis concurrency control

---

### 🧩 Flow Group: `AI-Integration`

## [11] `lib/aiModelManager.js`
**Type:** AI Model Management
**Dependencies:** @langchain/core, @langchain/openai, @langchain/google-genai
**Exports:** getAIModelManager, analyzeError, getCurrentModelInfo
**Summary:** AI model management for OpenAI and Google Gemini integration

---

### 🧩 Flow Group: `Circuit-Breaker`

## [12] `lib/circuitBreaker.js`
**Type:** Circuit Breaker Pattern
**Dependencies:** opossum
**Exports:** createCircuitBreaker, getCircuitState, resetCircuit
**Summary:** Circuit breaker implementation for AI API resilience

---

### 🧩 Flow Group: `Shared-Contracts`

## [13] `lib/shared/`
**Type:** Shared Contracts and Utilities
**Files:** asyncContracts.js, configValidation.js, constants.js, contracts.js, errorContext.js, errorContracts.js, execution.js, loggingCore.js, performanceMonitoring.js, response.js, responseBuilder.js, safeWrappers.js
**Summary:** Shared utilities, contracts, and common functionality used across modules

---

### 🧩 Flow Group: `Testing`

## [14] `test/basic.test.js`
**Type:** Unit Tests
**Dependencies:** index.js
**Summary:** Basic functionality tests for module loading and core utilities

---

### 🧩 Flow Group: `Type-Definitions`

## [15] `lib/types.d.ts`
**Type:** TypeScript Definitions
**Summary:** TypeScript type definitions for the qerrors module

---

### 🧩 Flow Group: `Package-Configuration`

## [16] `package.json`
**Type:** Package Configuration
**Dependencies:** axios, winston, lru-cache, p-limit, dotenv, escape-html, @langchain/* packages, opossum
**Summary:** npm package configuration and dependency management

## [17] `package-lock.json`
**Type:** Dependency Lock File
**Summary:** Locked dependency versions for reproducible builds

---

### 🧩 Flow Group: `Documentation`

## [18] `README.md`
**Type:** Project Documentation
**Summary:** Project documentation and usage instructions

## [19] `AGENTS.md`
**Type:** Agent Guidelines
**Summary:** AI agent development guidelines and constraints

## [20] `docs/CODEXSWARM.md`, `docs/CSUP.md`
**Type:** Additional Documentation
**Summary:** Supplementary documentation files

---

### 🧩 Flow Group: `Build-Scripts`

## [21] `scripts/`
**Type:** Build and Utility Scripts
**Files:** broadcast.sh, clean-dist.mjs, ensure-runner.mjs, kill-agent.sh, kill-all-agents.sh, list-agents.sh, send-to-agent.sh, spawn-agent.sh
**Summary:** Development and deployment scripts

---

## DATA FLOW SUMMARY

### Primary Error Handling Flow:
1. **Error occurs** → `lib/qerrors.js` (main middleware)
2. **Context creation** → `lib/shared/errorContext.js`, `lib/shared/logging.js`
3. **Sanitization** → `lib/sanitization.js`
4. **Logging** → `lib/logger.js`
5. **Queue management** → `lib/queueManager.js`
6. **AI analysis** → `lib/aiModelManager.js` (via `lib/qerrors.js`)
7. **Response formatting** → `lib/responseHelpers.js`
8. **Circuit breaking** → `lib/circuitBreaker.js` (for AI calls)

### Configuration Flow:
1. **Environment loading** → `lib/config.js` (dotenv)
2. **Validation** → `lib/envUtils.js`
3. **Type parsing** → `lib/config.js` (getInt, getEnv)
4. **Distribution** → All modules import from config

### Security Flow:
1. **Input sanitization** → `lib/sanitization.js`
2. **PII redaction** → Built into sanitization
3. **XSS prevention** → escape-html integration
4. **API key protection** → Environment variable management

### Performance Flow:
1. **Caching** → lru-cache in `lib/qerrors.js`
2. **Concurrency control** → p-limit in `lib/qerrors.js`
3. **Monitoring** → Performance timers in `lib/logger.js`
4. **Circuit breaking** → opossum in `lib/circuitBreaker.js`