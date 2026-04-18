/**
 * Security Middleware Configuration
 *
 * WHY: Every web application needs security headers and rate limiting.
 * Without these, attackers can:
 *   - Inject malicious scripts (XSS) via missing Content-Security-Policy
 *   - Trick users into clicking hidden buttons (Clickjacking) via missing X-Frame-Options
 *   - Sniff MIME types to execute malicious files via missing X-Content-Type-Options
 *   - Brute-force login endpoints without rate limiting
 *   - Fingerprint your server via the X-Powered-By header
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

/**
 * Configures Helmet security headers.
 *
 * Helmet sets these headers automatically:
 *   - Content-Security-Policy: Prevents XSS by controlling what resources load
 *   - X-Content-Type-Options: nosniff — Prevents MIME type sniffing
 *   - X-Frame-Options: DENY — Prevents your site from being embedded in iframes (clickjacking)
 *   - Strict-Transport-Security: Forces HTTPS connections
 *   - X-XSS-Protection: Enables browser's built-in XSS filter
 *   - Removes X-Powered-By: Hides that you're using Express (attackers use this for recon)
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],           // Only allow resources from same origin
      scriptSrc: ["'self'"],            // Only allow scripts from same origin
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles (needed for basic UI)
      imgSrc: ["'self'", "data:"],      // Allow images from same origin and data URIs
      connectSrc: ["'self'"],           // Only allow API calls to same origin
      fontSrc: ["'self'"],              // Only allow fonts from same origin
      objectSrc: ["'none'"],            // Block all <object>, <embed>, <applet>
      mediaSrc: ["'none'"],             // Block all <audio> and <video>
      frameSrc: ["'none'"],             // Block all <iframe>
    },
  },
  // Disabling crossOriginEmbedderPolicy for development convenience
  crossOriginEmbedderPolicy: false,
});

/**
 * Rate Limiter Configuration
 *
 * WHY: Without rate limiting, an attacker can:
 *   - Send millions of requests to crash your server (DDoS)
 *   - Brute-force passwords on login endpoints
 *   - Scrape your entire API
 *
 * This limits each IP to 100 requests per 15-minute window.
 * In production, you'd use stricter limits on auth endpoints.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15-minute window
  max: 100,                     // Max 100 requests per window per IP
  standardHeaders: true,        // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,         // Disable X-RateLimit-* headers (deprecated)
  message: {
    status: 429,
    error: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes',
  },
  // SECURITY: Skip rate limiting for health checks (needed for monitoring)
  // SECURITY: Skip rate limiting for infra endpoints
  // Prometheus scrapes /metrics every 15s — it would hit the limit very fast
  skip: (req) => req.path === '/health' || req.path === '/ready' || req.path === '/metrics',
});

/**
 * CORS Configuration
 *
 * WHY: CORS (Cross-Origin Resource Sharing) controls which domains
 * can make requests to your API. Without it:
 *   - Any website can make requests to your API using the user's cookies
 *   - This enables CSRF (Cross-Site Request Forgery) attacks
 *
 * In production, replace '*' with your actual frontend domain.
 */
const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',  // In dev, allow all. In production, restrict this!
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24 hours
});

/**
 * Request logger for security auditing
 *
 * WHY: Logging every request helps you:
 *   - Detect suspicious patterns (many 401s = brute force attempt)
 *   - Investigate security incidents after the fact
 *   - Meet compliance requirements (SOC 2, PCI-DSS)
 */
const morgan = require('morgan');
const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
);

/**
 * Apply all security middleware to an Express app
 * Order matters! Helmet and CORS should be first.
 */
function applySecurityMiddleware(app) {
  app.use(helmetMiddleware);      // 1. Set security headers FIRST
  app.use(corsMiddleware);        // 2. Configure CORS
  app.use(rateLimiter);           // 3. Rate limit requests
  app.use(requestLogger);         // 4. Log all requests

  // Parse JSON bodies with a size limit (prevents large payload attacks)
  app.use(express.json({ limit: '10kb' }));

  // Parse URL-encoded bodies with a size limit
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  return app;
}

const express = require('express');

module.exports = {
  applySecurityMiddleware,
  helmetMiddleware,
  rateLimiter,
  corsMiddleware,
  requestLogger,
};
