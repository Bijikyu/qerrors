// Frontend JavaScript for Error Handling API Demo
let metrics = {
    totalErrors: 0,
    queueLength: 0,
    cacheHits: 0,
    aiRequests: 0
};

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        document.getElementById('data-response').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('data-response').textContent = 'Error: ' + error.message;
    }
}

async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        document.getElementById('status-response').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('status-response').textContent = 'Error: ' + error.message;
    }
}

async function getMetrics() {
    try {
        const response = await fetch('/api/metrics');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update metrics display
        if (data.success && data.data) {
            // Update local metrics with server data if available
            if (data.data.qerrors) {
                metrics.queueLength = data.data.qerrors.queueLength || 0;
            }
            
            if (data.data.endpoints) {
                // Calculate total errors from endpoint stats
                const totalEndpointErrors = data.data.endpoints.reduce((sum, ep) => sum + ep.errors, 0);
                metrics.totalErrors = Math.max(metrics.totalErrors, totalEndpointErrors);
            }
        }
        
        document.getElementById('status-response').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('status-response').textContent = 'Error: ' + error.message;
    }
}

async function validateData() {
    const data = document.getElementById('name').value || 'test data';
    
    try {
        const response = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });
        const responseData = await response.json();
        document.getElementById('validation-response').textContent = JSON.stringify(responseData, null, 2);
    } catch (error) {
        document.getElementById('validation-response').textContent = 'Error: ' + error.message;
    }
}

async function validateInvalidData() {
    try {
        const response = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: 'x'  // Too short data
            })
        });
        const responseData = await response.json();
        document.getElementById('validation-response').textContent = JSON.stringify(responseData, null, 2);
    } catch (error) {
        document.getElementById('validation-response').textContent = 'Error: ' + error.message;
    }
}

async function triggerError() {
    try {
        const response = await fetch('/api/errors/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'basic',
                message: 'Test error from demo interface',
                context: {
                    source: 'demo.js',
                    timestamp: new Date().toISOString()
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.text();
        document.getElementById('error-response').textContent = data;
        metrics.totalErrors++;
    } catch (error) {
        document.getElementById('error-response').textContent = 'Error: ' + error.message;
    }
}

async function triggerCustomError() {
    try {
        const response = await fetch('/api/errors/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: 'DemoCustomError',
                message: 'This is a custom error from the demo interface',
                context: { 
                    source: 'demo.js',
                    timestamp: new Date().toISOString(),
                    severity: 'medium'
                },
                severity: 'medium'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.text();
        document.getElementById('custom-error-response').textContent = data;
        metrics.totalErrors++;
    } catch (error) {
        document.getElementById('custom-error-response').textContent = 'Error: ' + error.message;
    }
}

async function analyzeError() {
    try {
        const errorData = {
            message: 'Test error for AI analysis',
            name: 'TestError',
            stack: 'Error: Test error for AI analysis\\n    at analyzeError (demo.js:99:15)',
            type: 'test'
        };
        
        const response = await fetch('/api/errors/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                errorData: errorData,
                context: { 
                    endpoint: 'demo.js',
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        document.getElementById('analysis-response').textContent = JSON.stringify(data, null, 2);
        
        // Update metrics
        if (data.success) {
            metrics.aiRequests++;
        }
    } catch (error) {
        document.getElementById('analysis-response').textContent = 'Error: ' + error.message;
    }
}

async function testHtmlError() {
    try {
        const response = await fetch('/html/error');
        const data = await response.text();
        document.getElementById('html-error-response').textContent = data;
    } catch (error) {
        document.getElementById('html-error-response').textContent = 'Error: ' + error.message;
    }
}

async function testHtmlEscape() {
    try {
        const response = await fetch('/html/escape');
        const data = await response.json();
        document.getElementById('html-error-response').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('html-error-response').textContent = 'Error: ' + error.message;
    }
}

// Update metrics display
function updateMetricsDisplay() {
    // Update basic demo metrics
    const totalErrorsEl = document.getElementById('total-errors');
    const queueLengthEl = document.getElementById('queue-length');
    const cacheHitsEl = document.getElementById('cache-hits');
    const aiRequestsEl = document.getElementById('ai-requests');
    
    // Also try functional demo metric IDs
    const mTotalEl = document.getElementById('m-total');
    const mQueueEl = document.getElementById('m-queue');
    const mCacheEl = document.getElementById('m-cache');
    const mAiEl = document.getElementById('m-ai');
    
    // Update whichever elements exist
    if (totalErrorsEl) totalErrorsEl.textContent = metrics.totalErrors;
    if (queueLengthEl) queueLengthEl.textContent = metrics.queueLength;
    if (cacheHitsEl) cacheHitsEl.textContent = metrics.cacheHits;
    if (aiRequestsEl) aiRequestsEl.textContent = metrics.aiRequests;
    
    if (mTotalEl) mTotalEl.textContent = metrics.totalErrors;
    if (mQueueEl) mQueueEl.textContent = metrics.queueLength;
    if (mCacheEl) mCacheEl.textContent = metrics.cacheHits;
    if (mAiEl) mAiEl.textContent = metrics.aiRequests;
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Error Handling API Demo loaded');
    
    // Update metrics display initially
    updateMetricsDisplay();
    
    // Set up periodic metrics update
    setInterval(updateMetricsDisplay, 5000);
});