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
        const data = await response.json();
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
        const response = await fetch('/api/error');
        const data = await response.text();
        document.getElementById('error-response').textContent = data;
        metrics.totalErrors++;
    } catch (error) {
        document.getElementById('error-response').textContent = 'Error: ' + error.message;
    }
}

async function triggerCustomError() {
    try {
        const response = await fetch('/controller/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ controller: 'test', action: 'demo' })
        });
        const data = await response.text();
        document.getElementById('custom-error-response').textContent = data;
        metrics.totalErrors++;
    } catch (error) {
        document.getElementById('custom-error-response').textContent = 'Error: ' + error.message;
    }
}

async function analyzeError() {
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demo: 'config test' })
        });
        const data = await response.json();
        document.getElementById('analysis-response').textContent = JSON.stringify(data, null, 2);
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

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Error Handling API Demo loaded');
});