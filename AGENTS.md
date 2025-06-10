# AGENTS.md

## VISION

The qerrors module represents a paradigm shift from traditional error logging to intelligent error analysis. The core vision is to bridge the gap between error occurrence and resolution by leveraging AI to provide contextual debugging suggestions at the moment errors happen. This transforms error handling from a reactive debugging process into a proactive assistance system.

The business rationale centers on reducing developer debugging time and improving error resolution speed in production environments. By caching AI-generated advice and implementing queue-based analysis, the module balances the cost of AI API calls with the value of intelligent debugging assistance. The design assumes that most errors in production are repetitive patterns that can benefit from AI analysis, while avoiding infinite loops through careful axios error detection.

The module's economic model is built around cost-effective AI usage - caching prevents redundant API calls for identical errors, while concurrency limits prevent rate limiting charges. The queue-based approach ensures that expensive AI analysis never blocks critical application responses, maintaining user experience while providing debugging value.

The architecture prioritizes graceful degradation - the module must never break an application due to its own failures. This defensive approach influences every design decision, from the Promise-based async analysis to the careful separation of response generation and AI processing.

## FUNCTIONALITY

AI agents working on this codebase must understand that qerrors implements a sophisticated error handling middleware that must never cause additional errors. The module is designed to be "error-safe" meaning any failure in qerrors itself should fail silently rather than propagate.

Key agent boundaries:
- Never implement recursive error handling where qerrors processes its own errors
- Maintain the promise-based async pattern for AI analysis to prevent blocking application responses
- Preserve the LRU cache mechanism which is critical for cost control with AI APIs
- Respect the concurrency limiting system which prevents API rate limit violations

The AI analysis prompt engineering is specifically tuned for console output readability and practical debugging advice. Agents should not modify the prompt structure without understanding its optimization for avoiding generic responses and formatting issues in log files.

Expected behaviors for agents:
- Always test error scenarios without API tokens to ensure graceful degradation
- Verify that Express middleware contracts are maintained (proper next() handling)
- Ensure content negotiation works for both HTML and JSON responses
- Test queue overflow scenarios to verify rejection counting works correctly
- Validate that cache cleanup intervals don't interfere with application performance
- Confirm that verbose logging can be toggled without breaking functionality

## SCOPE

**In Scope:**
- Error handling middleware functionality and AI-powered analysis features
- Logging configuration and transport management
- Environment variable validation and configuration helpers
- Caching mechanisms for AI advice and queue management
- Express.js middleware integration and response handling
- Test coverage for all error handling scenarios

**Out of Scope:**
- Frontend error handling or client-side error reporting
- Database schema changes or data persistence beyond log files
- Authentication or authorization mechanisms
- Real-time error monitoring dashboards or alerting systems
- Integration with external monitoring services beyond OpenAI
- Performance profiling or application performance monitoring features

**Change Restrictions:**
- Do not modify the core error handling flow that prevents infinite recursion
- Do not alter the async analysis pattern that keeps responses fast
- Do not change the Express middleware signature without extensive testing

## CONSTRAINTS

**Protected Components:**
- The axios error detection logic in `analyzeError()` function must not be modified without understanding recursion prevention
- Environment variable defaults in `lib/config.js` require careful consideration as they affect production behavior
- The LRU cache TTL and cleanup mechanisms are performance-critical and must be preserved
- Test stubs in `/stubs` directory are dependency replacements and must maintain API compatibility
- The `postWithRetry()` function's exponential backoff algorithm is tuned for OpenAI API rate limits
- Socket connection pooling settings in the axios instance are optimized for AI API usage patterns
- The queue metrics collection system must not be modified without understanding memory implications

**Special Processes:**
- Any changes to OpenAI API integration require testing with and without API tokens
- Logging transport configuration changes need verification across different environments
- Cache limit modifications must consider memory usage implications in production
- Concurrency limit changes require load testing to avoid rate limiting issues

**Workflow Exceptions:**
- The module intentionally avoids standard function start/end logging to prevent noise in error scenarios
- Dependencies are intentionally minimal and should not be expanded without justification
- The module must remain compatible with Node.js 18+ as specified in package.json

## POLICY

**Module-Specific Policies:**
- This is an npm module that should remain framework-agnostic while providing Express middleware capabilities
- All AI API calls must implement retry logic with exponential backoff to handle transient failures
- Error messages must be developer-friendly and avoid generic phrases that don't aid debugging
- The module should gracefully handle OpenAI API changes and response format variations
- Version compatibility must be maintained for Node.js LTS versions (currently 18+)
- The module must never require external databases or persistent storage beyond file system logs
- AI prompt engineering should prioritize actionable debugging advice over generic error descriptions

**Testing Requirements:**
- Every new feature must include tests for both success and failure scenarios
- API integration tests must work with stubbed responses to avoid external dependencies
- Cache behavior must be tested for both hit and miss scenarios
- Queue limits and concurrency controls must be verified under load

**Security Considerations:**
- Environment variables containing API keys must never be logged or exposed in error messages
- User-provided error data must be sanitized when generating HTML responses
- The module must not introduce XSS vulnerabilities through error message display

**Maintenance Standards:**
- Keep dependencies minimal and prefer Node.js built-in modules where possible
- Maintain backward compatibility for major version increments
- Document any breaking changes clearly in changelog and migration guides
- Performance benchmarks must be maintained for key operations (cache lookups, queue processing)
- Memory usage patterns should be monitored, especially for long-running applications
- OpenAI API cost implications must be documented for any changes to prompt structure or frequency