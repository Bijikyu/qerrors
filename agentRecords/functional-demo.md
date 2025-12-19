# Functional Demo: QErrors Frontend

A self-contained HTML page to exercise core frontend flows for testing and validation without a backend.

What it covers
- Error testing (basic and critical) with simulated responses
- Custom error creation and handling
- AI analysis workflow with scenario/provider selection
- Basic metrics visualization (total errors, queue, cache hits, AI requests)
- Logs export and metric reset

How to run
- Open `demo-functional.html` at repo root in a modern browser, or serve it via a static file server (e.g. `npx http-server` from project root).
- If you want to test programmatic loading, you can use any server that serves static files on port 8080+.

What the demo covers
- Client-side mock flows to demonstrate UX without a backend
- UI scaffolding designed to mirror real API interactions in the qerrors frontend
- Lightweight data shapes for errors, AI analysis, and metrics

Next steps
- If you want to tailor the UI to certain flows or add more scenarios, I can adapt the demo accordingly.
