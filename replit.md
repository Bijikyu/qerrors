# qerrors - Intelligent Error Handling Middleware

## Overview

qerrors is a Node.js middleware library that combines traditional error logging with AI-powered debugging assistance. It provides intelligent error analysis using OpenAI's GPT models while maintaining production-ready reliability through graceful degradation, caching, and queue management.

The system is designed with a "never break the application" philosophy - all AI features are optional and the middleware will continue functioning even when external services fail.

## System Architecture

### Core Components
- **Error Handling Middleware**: Express.js compatible middleware for capturing and processing errors
- **AI Analysis Engine**: OpenAI GPT-4o integration for generating contextual debugging advice
- **Caching Layer**: LRU cache with TTL for cost-effective AI advice storage
- **Queue Management**: Concurrency-limited queue system for managing AI analysis requests
- **Logging System**: Winston-based structured logging with file rotation

### Technology Stack
- **Runtime**: Node.js 18+
- **HTTP Client**: Axios with custom retry logic and connection pooling
- **Caching**: Custom LRU cache with time-to-live support
- **Queue**: Denque-based double-ended queue for O(1) operations
- **Logging**: Enhanced Winston with security-aware sanitization, performance monitoring, and structured logging
- **Security**: HTML escaping for safe error output plus comprehensive data sanitization

## Key Components

### Error Processing Pipeline
1. **Error Capture**: Middleware intercepts errors from Express applications
2. **Unique Identification**: Generates crypto-based unique identifiers for error tracking
3. **Context Analysis**: Extracts and processes error context including stack traces
4. **Security Sanitization**: Removes sensitive data from logs using pattern-based detection
5. **AI Analysis**: Queues errors for OpenAI analysis with caching and retry logic
6. **Enhanced Logging**: Structured logging with performance monitoring and request correlation
7. **Response Generation**: Returns structured JSON or HTML responses based on Accept headers

### Configuration System
- **Environment Variables**: 20+ configurable parameters for fine-tuning behavior
- **Defaults**: Production-ready defaults with conservative resource limits
- **Validation**: Built-in environment variable validation with helpful error messages
- **Dynamic Configuration**: Runtime configuration changes without restarts

### Queue and Concurrency Management
- **Concurrency Limiting**: Configurable concurrent AI analysis requests (default: 5)
- **Queue Management**: Bounded queue with overflow protection (default: 100 pending)
- **Metrics**: Built-in queue health monitoring and logging
- **Backpressure**: Graceful degradation when system is overloaded

## Data Flow

1. **Error Occurrence**: Application error triggers middleware
2. **Error Enrichment**: Unique ID generation and context extraction
3. **Immediate Response**: HTTP response sent to client without waiting for AI analysis
4. **Background Analysis**: Error queued for AI processing with concurrency control
5. **Cache Check**: System checks for existing advice before API call
6. **AI Analysis**: OpenAI API call with retry logic and timeout protection
7. **Cache Storage**: Results stored in LRU cache for future identical errors
8. **Logging**: Structured logs written to rotating files

## External Dependencies

### Required Services
- **OpenAI API**: GPT-4o model for error analysis (optional - graceful degradation when unavailable)

### NPM Dependencies
- **axios**: HTTP client with retry and connection pooling
- **winston**: Structured logging framework
- **winston-daily-rotate-file**: Log rotation management
- **denque**: High-performance queue implementation
- **lru-cache**: Memory-efficient caching with TTL support
- **escape-html**: Security-focused HTML escaping
- **qtests**: Testing utilities for mocking and stubbing

## Deployment Strategy

### Environment Configuration
- **Development**: Verbose logging enabled, reduced cache sizes, immediate error feedback
- **Production**: File-only logging, optimized cache settings, queue metrics monitoring
- **High Traffic**: Increased concurrency limits, larger caches, enhanced connection pooling

### Resource Management
- **Memory**: LRU cache with configurable limits and TTL-based cleanup
- **Network**: Connection pooling with configurable socket limits
- **File System**: Rotating logs with size and time-based retention policies
- **API Costs**: Intelligent caching prevents redundant OpenAI API calls

### Monitoring and Observability
- **Queue Metrics**: Periodic logging of queue depth and processing rates
- **Error Tracking**: Unique error IDs for correlation across logs
- **Performance Monitoring**: Built-in timing and resource usage tracking
- **Health Checks**: Environment validation on startup with helpful warnings

## Changelog

```
Changelog:
- June 17, 2025. Initial setup
- June 17, 2025. Enhanced error middleware with meta-error handling, headers protection, and improved fallback responses
- June 17, 2025. Integrated comprehensive enhanced logging system with security-aware sanitization, performance monitoring, request correlation, and structured logging capabilities
- August 10, 2025. Successfully migrated from axios-based OpenAI implementation to LangChain architecture supporting multiple AI providers (OpenAI and Google Gemini). Added Gemini 2.5 Flash-lite model support as requested by user. Updated all tests to work with new architecture. Fixed nested object sanitization logic for enhanced logging. All 146 tests now passing.
- August 11, 2025. Successfully completed qtests module integration with ALL TESTS PASSING! Enhanced testing infrastructure with qtests utilities achieving ~30% reduction in test boilerplate code. Created lib/testUtils.js with QerrorsTestEnv and QerrorsStubbing classes. Implemented conditional qtests setup to avoid winston conflicts. Fixed 24 failing tests by resolving qtests.stubMethod compatibility issues with wrapped functions through hybrid stubbing approach. Added comprehensive analysis documentation (QTESTS_ANALYSIS.md) and demonstration tests. Created test-runner.js at root for unified test execution. Fixed verbose behavior: AI advice now prints to console by default, can be suppressed with QERRORS_VERBOSE=false. Test suite: 157/157 tests passing (100% success rate).
- August 11, 2025. Updated environment variable naming for Google Gemini API from GOOGLE_API_KEY to GEMINI_API_KEY throughout codebase. Updated all references in README.md, lib/qerrors.js, lib/aiModelManager.js, and test files (analyzeError.test.js, queue.test.js, maxTokens.test.js). All 157 tests still passing after changes.
- August 11, 2025. Repositioned Google Gemini as primary AI provider in documentation and code. Updated README.md to feature GEMINI_API_KEY as the primary provider with explicit secret key name references, positioned OpenAI as optional alternative. Changed default provider from OpenAI to Google Gemini in aiModelManager.js. Updated all documentation sections, configuration examples, and feature descriptions to prioritize Gemini. All 157 tests passing.
- August 11, 2025. Added comprehensive documentation for QERRORS_AI_MODEL environment variable in README.md. Documented all available models for each provider: Google Gemini (gemini-2.5-flash-lite, gemini-2.0-flash-exp, gemini-pro, gemini-1.5-pro, gemini-1.5-flash) and OpenAI (gpt-4o, gpt-4o-mini, gpt-4, gpt-3.5-turbo). Added complete configuration examples, practical usage scenarios, and enhanced AI Model Manager documentation with model selection examples. All 157 tests passing.
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
Testing policy: Don't report anything as fixed until you have tested it.
Test suite requirement: Run the full test suite as step 3 and only after that also works report success.
```