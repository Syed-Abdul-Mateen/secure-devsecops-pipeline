/**
 * Express Application Setup
 *
 * WHY this file is separate from server.js:
 *   - app.js exports the Express app for testing (supertest needs the app, not the running server)
 *   - server.js starts listening on a port
 *   - This separation is a best practice that makes unit testing possible
 *   - Without it, your tests would start a real server on every test run (port conflicts!)
 */

const express = require('express');
const path = require('path');
const { applySecurityMiddleware } = require('./middleware/security');
const { metricsMiddleware, metricsRoute } = require('./middleware/metrics');
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');

// Create Express application
const app = express();

// =============================================================
// STEP 1: Apply security middleware FIRST
// WHY: Security headers must be set before any route responds.
// If a route responds before Helmet runs, that response won't
// have security headers — leaving it vulnerable.
// =============================================================
applySecurityMiddleware(app);

// =============================================================
// STEP 1b: Apply metrics middleware
// WHY: Must be registered AFTER security middleware so Helmet
// headers are set, but BEFORE routes so all requests are tracked.
// =============================================================
app.use(metricsMiddleware);

// =============================================================
// STEP 2: Mount routes
// =============================================================

// Health check routes (no /api prefix — convention for infra endpoints)
app.use('/', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// =============================================================
// Prometheus metrics endpoint
// WHY /metrics? This is the Prometheus convention.
// Prometheus is configured to scrape this path every 15s.
// SECURITY: In production, protect this with auth or restrict
// it to internal network only (not exposed publicly).
// =============================================================
app.get('/metrics', metricsRoute);

// =============================================================
// STEP 3: Root route — serves a simple landing page
// =============================================================
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🔐 Secure DevSecOps Pipeline API',
    status: 'running',
    docs: '/api/info',
    health: '/health',
    timestamp: new Date().toISOString(),
  });
});

// =============================================================
// STEP 4: 404 Handler — catch undefined routes
// WHY: Without this, Express returns a default HTML error page
// which leaks information about your stack (attackers use this).
// =============================================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist.`,
    suggestion: 'Check /api/info for available endpoints.',
  });
});

// =============================================================
// STEP 5: Global error handler
// WHY: Without this, unhandled errors return stack traces to the client.
// Stack traces reveal:
//   - File paths on your server
//   - Which libraries you use (and their versions)
//   - Internal logic of your application
// Attackers use ALL of this for reconnaissance.
// =============================================================
app.use((err, req, res, next) => {
  // Log the full error for debugging (server-side only)
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  console.error(err.stack);

  // Send a safe error response (no internal details!)
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    // NEVER send err.stack to the client in production!
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
