/**
 * Server Entry Point
 *
 * WHY this is separate from app.js:
 *   - app.js defines the Express application (routes, middleware)
 *   - server.js starts listening on a port
 *   - Tests import app.js directly (no server started)
 *   - This prevents port conflicts during testing
 */

// Load environment variables from .env file FIRST
// WHY: dotenv must be loaded before any other code that reads process.env
require('dotenv').config();

const app = require('./app');

// Use PORT from environment variable, fallback to 3000
// WHY: Cloud platforms (AWS, Heroku, etc.) set the PORT env variable
// Your app MUST respect this or deployment will fail
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(` Secure DevSecOps API Server`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Server running on: http://localhost:${PORT}`);
  console.log(`️  Health check: http://localhost:${PORT}/health`);
  console.log(` API docs: http://localhost:${PORT}/api/info`);
  console.log('='.repeat(50));
});

// =============================================================
// Graceful Shutdown
// WHY: When Docker stops a container, it sends SIGTERM.
// If your app doesn't handle this:
//   - Active requests get dropped mid-response
//   - Database connections aren't closed properly
//   - Data can be corrupted
// Docker waits 10 seconds, then sends SIGKILL (forced kill)
// =============================================================
function gracefulShutdown(signal) {
  console.log(`\n️  Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log(' HTTP server closed. All pending requests completed.');
    console.log(' Process exiting gracefully.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error(' Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker stop
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C

// =============================================================
// Unhandled Error Handlers
// WHY: Without these, unhandled errors crash your entire server.
// In production, you want to:
//   1. Log the error
//   2. Alert your team (PagerDuty, Slack, etc.)
//   3. Exit cleanly (let Docker/PM2 restart the process)
// =============================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error(' Unhandled Promise Rejection:', reason);
  // In production, you'd send this to an error tracking service
  // like Sentry, Datadog, or New Relic
});

process.on('uncaughtException', (error) => {
  console.error(' Uncaught Exception:', error);
  // Uncaught exceptions leave the app in an unknown state
  // The safest thing to do is exit and let the process manager restart
  process.exit(1);
});

module.exports = server;
