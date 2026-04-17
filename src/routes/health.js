/**
 * Health Check Routes
 *
 * WHY: Health endpoints are critical for:
 *   1. Container orchestration (Docker, Kubernetes) — they check if your app is alive
 *   2. Load balancers (AWS ALB) — they route traffic away from unhealthy instances
 *   3. Monitoring (Prometheus) — scrapes /health to track uptime
 *   4. CI/CD pipelines — verify deployment succeeded
 *
 * Two types of health checks:
 *   /health  — "Liveness probe": Is the process running?
 *   /ready   — "Readiness probe": Is the app ready to handle traffic?
 *              (e.g., database connected, caches warm)
 */

const express = require('express');
const router = express.Router();

// Track when the server started (for uptime calculation)
const startTime = Date.now();

/**
 * GET /health
 * Liveness Probe — Checks if the Node.js process is alive
 *
 * Returns: 200 OK if the process is running
 * Used by: Docker HEALTHCHECK, Kubernetes livenessProbe, load balancers
 */
router.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    },
  });
});

/**
 * GET /ready
 * Readiness Probe — Checks if the app is ready to serve traffic
 *
 * In a real app, this would check:
 *   - Database connection is alive
 *   - Redis/cache is connected
 *   - External APIs are reachable
 *
 * Returns: 200 if ready, 503 if not
 * Used by: Kubernetes readinessProbe, load balancers before routing traffic
 */
router.get('/ready', (req, res) => {
  // In a real app, you'd check database connectivity here
  const checks = {
    server: true,
    // database: await checkDatabaseConnection(),
    // cache: await checkRedisConnection(),
  };

  const allHealthy = Object.values(checks).every((check) => check === true);

  if (allHealthy) {
    res.status(200).json({
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  } else {
    // 503 Service Unavailable — tells load balancer to stop sending traffic
    res.status(503).json({
      status: 'not ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
