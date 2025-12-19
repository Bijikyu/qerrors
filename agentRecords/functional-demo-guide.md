# QErrors Frontend Functional Demo (npm-only)

A lightweight, self-contained frontend demo to exercise core user flows of the QErrors UI without Bun. It runs alongside the backend started with npm and is served from the repo root.

## Prerequisites

- Node.js v18+ and npm
- No Bun, no browser extensions required
- Backend server (OpenAI-backed or simulated) may be running on the default port; this guide focuses on the frontend

## What this demo covers

- Basic error generation and response rendering (JSON and HTML)
- Controller-style error handling and async wrappers
- AI analysis and AI caching simulations
- Queue management and load scenarios
- Model comparison and fallback scenarios
- Cache management and performance indicators
- Security checks: XSS protection, input sanitization, API key handling, content negotiation

> Note: The demo is intentionally a front-end simulator to illustrate flows. To test real backend behavior, wire the demo to your API endpoints as described in the “Connecting to the Backend” section.

## How to run

1. Install dependencies and build the backend (npm-only):
   - `npm install`
   - `npm run build`  (optional if you only want to run the backend as a separate process)

2. Start the backend server (npm-only):
   - `npm run start`
   - This will run the Node.js backend (dist/index.js) on its configured port.

3. Run the frontend demo server (npm-only):
   - In a separate terminal: `node demo-server.js`
   - The static frontend will be served at http://localhost:8080/demo.html

4. Open the demo in your browser:
   - http://localhost:8080/demo.html

## How to use the frontend demo

- On the top, use the Configuration panel to adjust the AI provider, model, API key, log level, concurrency, and cache limits. Click Apply Configuration to apply changes.
- Use the tabbed sections to exercise flows:
  - Basic Tests: generate JSON/HTML errors and test controller/async wrapper paths
  - Error Types: run validation, authentication, network, database, and system error simulations
  - AI Analysis: run AI analysis and caching simulations
  - Performance: run load tests and review performance metrics
  - Security: test XSS protection, input sanitization, API key handling, and content negotiation

- The right-hand live metrics area shows simulated stats for total errors, queue length, cache hits, AI analyses, and avg response time. Metrics update periodically to mimic a live system.

## Connecting to the Backend (optional)

- The demo is currently a front-end simulator. To connect to your real backend, replace the simulateAsyncOperation blocks with real fetch calls to your Express endpoints. Example:

```
fetch('/api/errors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: 'Something went wrong', context: 'demo' })
})
  .then(res => res.json())
  .then(data => { /* render data in response area */ })
  .catch(err => { /* handle error */ });
```

- Ensure CORS and authentication are properly configured on the backend as needed.

## Troubleshooting

- If http://localhost:8080/demo.html fails to load, ensure the frontend server is running and there are no port conflicts. Check the console for script execution errors in the browser.
- If you see 404s for assets, verify that the demo.html path matches the static file you intend to load and that you’re serving the repository root.

## Notes

- This frontend is designed for quick testing and demonstrations and is not intended to replace full integration tests.
- Backward compatibility is not a concern per project direction.
