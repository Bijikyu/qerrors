/**
 * Enhanced Error Debugging Utilities
 * 
 * Provides improved error handling patterns for better debugging
 * and production troubleshooting capabilities.
 */

const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');

/**
 * Enhanced error handler with debugging capabilities
 */
class EnhancedErrorHandler {
  constructor(options = {}) {
    this.options = {
      enableStackTrace: options.enableStackTrace !== false,
      enablePerformanceTracking: options.enablePerformanceTracking !== false,
      enableContextCapture: options.enableContextCapture !== false,
      enableErrorAggregation: options.enableErrorAggregation !== false,
      debugMode: options.debugMode || false,
      ...options
    };
    
    this.errorPatterns = new Map();
    this.errorCounts = new Map();
    this.performanceBaseline = null;
  }

  /**
   * Enhanced error analysis with debugging context
   */
  analyzeError(error, context = {}) {
    const analysis = this.createEnhancedAnalysis(error, context);
    
    // Track error patterns for debugging
    this.trackErrorPattern(error);
    
    // Aggregate similar errors
    if (this.options.enableErrorAggregation) {
      this.aggregateError(error, analysis);
    }
    
    return analysis;
  }

  /**
   * Create enhanced error analysis with debugging information
   */
  createEnhancedAnalysis(error, context) {
    const timestamp = Date.now();
    const errorId = this.generateErrorId();
    
    const analysis = {
      id: errorId,
      timestamp,
      
      // Enhanced error information
      error: {
        name: error.name || 'UnknownError',
        message: this.sanitizeErrorMessage(error.message),
        code: error.code || this.generateErrorCode(error),
        type: this.classifyErrorType(error),
        severity: this.determineSeverity(error, context)
      },
      
      // Enhanced debugging context
      context: {
        ...this.captureDebugContext(),
        ...context,
        debugMode: this.options.debugMode,
        nodeId: process.env.NODE_ID || 'unknown'
      },
      
      // Performance tracking
      performance: this.options.enablePerformanceTracking ? {
        processingTime: null, // Will be set by caller
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: performance.now()
      } : null,
      
      // Stack trace analysis
      stackTrace: this.options.enableStackTrace ? 
        this.analyzeStackTrace(error.stack) : null,
      
      // Debugging assistance
      debugging: {
        suggestions: this.generateDebugSuggestions(error),
        relatedErrors: this.findRelatedErrors(error),
        frequency: this.getErrorFrequency(error),
        firstOccurrence: this.getFirstOccurrence(error)
      }
    };
    
    return analysis;
  }

  /**
   * Analyze stack trace for debugging insights
   */
  analyzeStackTrace(stack) {
    if (!stack) return null;
    
    const lines = stack.split('\\n').slice(0, 10);
    const analyzed = lines.map((line, index) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          index,
          function: match[1],
          file: match[2],
          line: parseInt(match[3]),
          column: parseInt(match[4]),
          type: this.classifyStackLine(match[1])
        };
      }
      
      return {
        index,
        raw: line.trim(),
        type: 'unknown'
      };
    });
    
    // Extract key insights
    const userCodeLines = analyzed.filter(line => 
      line.type === 'user' && line.file && !line.file.includes('node_modules')
    );
    
    return {
      fullStack: analyzed,
      userCodeOnly: userCodeLines,
      summary: {
        totalFrames: analyzed.length,
        userCodeFrames: userCodeLines.length,
        deepestUserCode: userCodeLines[userCodeLines.length - 1],
        entryPoint: userCodeLines[0]
      }
    };
  }

  /**
   * Classify stack line type for debugging
   */
  classifyStackLine(functionName) {
    if (functionName.includes('Module.') || functionName.includes('require')) {
      return 'module';
    }
    if (functionName.includes('EventEmitter') || functionName.includes('emit')) {
      return 'event';
    }
    if (functionName.includes('async') || functionName.includes('await')) {
      return 'async';
    }
    if (functionName.includes('Promise') || functionName.includes('then')) {
      return 'promise';
    }
    
    return 'user';
  }

  /**
   * Generate debugging suggestions based on error type
   */
  generateDebugSuggestions(error) {
    const suggestions = [];
    
    // Type-based suggestions
    if (error.name === 'TypeError') {
      suggestions.push({
        priority: 'high',
        type: 'type_check',
        message: 'Add type validation before accessing properties',
        code: 'if (obj && typeof obj.property === "undefined") { ... }'
      });
    }
    
    if (error.name === 'ReferenceError') {
      suggestions.push({
        priority: 'high',
        type: 'variable_check',
        message: 'Verify variable is declared and in scope',
        code: 'console.log(variableName); // Debug variable exists'
      });
    }
    
    // Context-based suggestions
    if (error.message && error.message.includes('timeout')) {
      suggestions.push({
        priority: 'medium',
        type: 'timeout',
        message: 'Consider increasing timeout or adding retry logic',
        code: '// Increase timeout or implement retry'
      });
    }
    
    // Memory-related suggestions
    if (error.message && error.message.includes('memory')) {
      suggestions.push({
        priority: 'high',
        type: 'memory',
        message: 'Monitor memory usage and implement cleanup',
        code: 'if (process.memoryUsage().heapUsed > threshold) { cleanup(); }'
      });
    }
    
    return suggestions;
  }

  /**
   * Capture enhanced debugging context
   */
  captureDebugContext() {
    const context = {};
    
    if (this.options.enableContextCapture) {
      // Process information
      context.process = {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      };
      
      // Memory information
      context.memory = {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      };
      
      // Environment information
      context.environment = {
        nodeEnv: process.env.NODE_ENV || 'development',
        debug: process.env.DEBUG || false
      };
    }
    
    return context;
  }

  /**
   * Track error patterns for trend analysis
   */
  trackErrorPattern(error) {
    const key = this.generateErrorKey(error);
    
    if (!this.errorPatterns.has(key)) {
      this.errorPatterns.set(key, {
        count: 0,
        firstSeen: Date.now(),
        lastSeen: null,
        contexts: []
      });
    }
    
    const pattern = this.errorPatterns.get(key);
    pattern.count++;
    pattern.lastSeen = Date.now();
    
    // Keep only recent contexts (last 10)
    if (pattern.contexts.length >= 10) {
      pattern.contexts.shift();
    }
    
    pattern.contexts.push({
      timestamp: Date.now(),
      memory: process.memoryUsage()
    });
  }

  /**
   * Generate unique error key for pattern tracking
   */
  generateErrorKey(error) {
    const name = error.name || 'UnknownError';
    const message = error.message || 'Unknown message';
    
    // Normalize message by removing dynamic parts (timestamps, IDs, etc.)
    const normalizedMessage = message
      .replace(/\\d+/g, 'N') // Replace numbers
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, 'UUID') // Replace UUIDs
      .replace(/\\b\\w+\\b\\.\\w+\\b/g, 'DOMAIN.PATH') // Replace domains/paths
      .substring(0, 100); // Limit length
    
    return `${name}:${normalizedMessage}`;
  }

  /**
   * Find related errors based on patterns
   */
  findRelatedErrors(error) {
    const currentKey = this.generateErrorKey(error);
    const related = [];
    
    for (const [key, pattern] of this.errorPatterns.entries()) {
      if (key !== currentKey && this.areErrorsRelated(currentKey, key)) {
        related.push({
          key,
          count: pattern.count,
          lastSeen: pattern.lastSeen,
          similarity: this.calculateSimilarity(currentKey, key)
        });
      }
    }
    
    return related.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  /**
   * Calculate similarity between error keys
   */
  calculateSimilarity(key1, key2) {
    const words1 = key1.toLowerCase().split(/[:\\s]+/);
    const words2 = key2.toLowerCase().split(/[:\\s]+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Determine if errors are related
   */
  areErrorsRelated(key1, key2) {
    const similarity = this.calculateSimilarity(key1, key2);
    return similarity > 0.5; // 50% similarity threshold
  }

  /**
   * Get error frequency information
   */
  getErrorFrequency(error) {
    const key = this.generateErrorKey(error);
    const pattern = this.errorPatterns.get(key);
    
    return pattern ? {
      count: pattern.count,
      firstSeen: pattern.firstSeen,
      lastSeen: pattern.lastSeen,
      frequency: pattern.count / ((Date.now() - pattern.firstSeen) / 1000 / 60) // per minute
    } : { count: 0, frequency: 0 };
  }

  /**
   * Get first occurrence of error
   */
  getFirstOccurrence(error) {
    const key = this.generateErrorKey(error);
    const pattern = this.errorPatterns.get(key);
    
    return pattern ? pattern.firstSeen : null;
  }

  /**
   * Sanitize error message for debugging
   */
  sanitizeErrorMessage(message) {
    if (!message) return 'Unknown error';
    
    return String(message)
      .replace(/password[\\s]*[:=][\\s]*\\S+/gi, 'password: [REDACTED]')
      .replace(/token[\\s]*[:=][\\s]*\\S+/gi, 'token: [REDACTED]')
      .replace(/secret[\\s]*[:=][\\s]*\\S+/gi, 'secret: [REDACTED]')
      .replace(/key[\\s]*[:=][\\s]*\\S+/gi, 'key: [REDACTED]')
      .substring(0, 500); // Limit length
  }

  /**
   * Classify error type for better handling
   */
  classifyErrorType(error) {
    const name = error.name || 'Error';
    const message = (error.message || '').toLowerCase();
    
    if (name === 'TypeError') return 'type';
    if (name === 'ReferenceError') return 'reference';
    if (name === 'SyntaxError') return 'syntax';
    if (name === 'RangeError') return 'range';
    if (name === 'EvalError') return 'eval';
    if (name === 'URIError') return 'uri';
    
    // Message-based classification
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('econnrefused')) return 'network';
    if (message.includes('permission') || message.includes('unauthorized')) return 'permission';
    if (message.includes('file') || message.includes('enoent')) return 'filesystem';
    if (message.includes('memory') || message.includes('heap')) return 'memory';
    
    return 'unknown';
  }

  /**
   * Determine error severity based on context
   */
  determineSeverity(error, context) {
    // Explicit severity from context
    if (context.severity) return context.severity;
    
    const name = error.name || 'Error';
    const message = (error.message || '').toLowerCase();
    
    // Critical errors
    if (message.includes('fatal') || message.includes('crash') || 
        name === 'SyntaxError' && this.options.debugMode) {
      return 'critical';
    }
    
    // High severity
    if (message.includes('timeout') || message.includes('memory') ||
        name === 'RangeError' || name === 'ReferenceError') {
      return 'high';
    }
    
    // Medium severity
    if (name === 'TypeError' || name === 'URIError' ||
        message.includes('network') || message.includes('permission')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Generate error code if not present
   */
  generateErrorCode(error) {
    const type = this.classifyErrorType(error);
    const hash = this.simpleHash(error.message || '');
    
    return `${type.toUpperCase()}_${hash.toString(16).substring(0, 4).toUpperCase()}`;
  }

  /**
   * Simple hash function for error codes
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get debugging insights
   */
  getDebuggingInsights() {
    const insights = {
      totalErrorTypes: this.errorPatterns.size,
      mostFrequentErrors: [],
      recentErrorTrends: [],
      memoryCorrelation: []
    };
    
    // Find most frequent errors
    const frequent = Array.from(this.errorPatterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, pattern]) => ({
        key,
        count: pattern.count,
        frequency: pattern.count / ((Date.now() - pattern.firstSeen) / 1000 / 60)
      }));
    
    insights.mostFrequentErrors = frequent;
    
    return insights;
  }

    /**
     * Clear error patterns
     */
    clearPatterns() {
      this.errorPatterns.clear();
      this.errorCounts.clear();
    }

    /**
     * Aggregate error for tracking
     */
    aggregateError(error, analysis) {
      const key = this.generateErrorKey(error);
      
      if (!this.errorCounts.has(key)) {
        this.errorCounts.set(key, {
          count: 0,
          firstSeen: Date.now(),
          lastSeen: null,
          analyses: []
        });
      }
      
      const count = this.errorCounts.get(key);
      count.count++;
      count.lastSeen = Date.now();
      
      // Keep only recent analyses (last 5)
      if (count.analyses.length >= 5) {
        count.analyses.shift();
      }
      
      count.analyses.push(analysis);
    }
  }

// Export singleton instance
const enhancedErrorHandler = new EnhancedErrorHandler({
  enableStackTrace: true,
  enablePerformanceTracking: true,
  enableContextCapture: true,
  enableErrorAggregation: true,
  debugMode: process.env.NODE_ENV === 'development'
});

module.exports = {
  EnhancedErrorHandler,
  enhancedErrorHandler,
  
  // Convenience functions
  analyzeError: (error, context) => enhancedErrorHandler.analyzeError(error, context),
  getDebuggingInsights: () => enhancedErrorHandler.getDebuggingInsights(),
  clearPatterns: () => enhancedErrorHandler.clearPatterns()
};