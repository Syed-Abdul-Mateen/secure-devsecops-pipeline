/**
 * Prometheus Metrics Middleware
 *
 * WHY: Prometheus needs a /metrics endpoint to scrape.
 * prom-client is the official Node.js client for Prometheus.
 *
 * WHAT IS PROMETHEUS SCRAPING?
 * Instead of your app "pushing" metrics to Prometheus,
 * Prometheus "pulls" (scrapes) metrics from your app every 15s.
 * Your app exposes metrics at /metrics in a text format, and
 * Prometheus reads it on a schedule.
 *
 * METRICS WE TRACK:
 *   - HTTP request count (by method, route, status code)
 *   - HTTP request duration (histogram — percentiles: p50, p90, p99)
 *   - Active HTTP connections (gauge)
 *   - Default Node.js metrics (CPU, memory, GC, event loop lag)
 */

const client = require('prom-client');

// =============================================================
// COLLECTOR REGISTRY
// All metrics are registered here. One registry per app.
// =============================================================
const register = new client.Registry();

// Collect default Node.js metrics automatically:
//   - process_cpu_seconds_total
//   - process_resident_memory_bytes
//   - nodejs_heap_size_total_bytes
//   - nodejs_active_handles_total
//   - nodejs_gc_duration_seconds (garbage collection)
//   - nodejs_eventloop_lag_seconds (event loop health)
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',   // All default metrics are prefixed with 'nodejs_'
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// =============================================================
// CUSTOM METRIC 1: HTTP Request Counter
// A Counter only goes UP — perfect for counting requests.
// Labels let you slice data: by method, route, and status.
// =============================================================
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests made',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// =============================================================
// CUSTOM METRIC 2: HTTP Request Duration Histogram
// A Histogram tracks the distribution of request durations.
// Buckets: [50ms, 100ms, 200ms, 500ms, 1s, 2s, 5s]
// This lets you calculate p50, p90, p99 response times in Grafana.
//
// WHY p99 matters: If p99 = 2s, 1% of users wait 2+ seconds.
// For 10,000 req/min, that's 100 users per minute getting slow responses.
// =============================================================
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

// =============================================================
// CUSTOM METRIC 3: Active Connections Gauge
// A Gauge can go up or down — perfect for active connections.
// =============================================================
const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// =============================================================
// MIDDLEWARE: Track every HTTP request
// This middleware runs BEFORE your route handlers.
// It records the start time, then hooks into the response
// to record the duration after the response is sent.
// =============================================================
function metricsMiddleware(req, res, next) {
  // Increment active connections
  activeConnections.inc();

  // Record when the request started
  const startTime = Date.now();

  // Hook into response finish event
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;

    // Normalize route to avoid high-cardinality labels
    // WHY? If we use exact paths, /users/123 and /users/456 create
    // separate metric series. Normalizing to /users/:id prevents this.
    const route = req.route ? req.route.path : req.path;

    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
    };

    // Increment request counter
    httpRequestsTotal.inc(labels);

    // Record request duration
    httpRequestDuration.observe(labels, durationSec);

    // Decrement active connections
    activeConnections.dec();
  });

  next();
}

// =============================================================
// METRICS ROUTE HANDLER
// This is what Prometheus scrapes every 15 seconds.
// Returns all metrics in Prometheus text format.
// =============================================================
async function metricsRoute(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.message);
  }
}

module.exports = {
  metricsMiddleware,
  metricsRoute,
  register,
  // Export individual metrics for use in route handlers
  httpRequestsTotal,
  httpRequestDuration,
};
