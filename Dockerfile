# =============================================================
# MULTI-STAGE DOCKERFILE
# =============================================================
#
# WHY Multi-Stage Builds?
# Without multi-stage builds, your final image contains:
#   - Build tools (gcc, make, etc.) — not needed in production
#   - Dev dependencies (eslint, jest, nodemon) — not needed in production
#   - Source maps, test files — not needed in production
#
# An attacker who gets into your container can use those tools
# to escalate, pivot, or exfiltrate data.
#
# Multi-stage builds give you a MINIMAL final image with only
# what's needed to RUN the app — nothing else.
# =============================================================

# =============================================================
# STAGE 1: Build Stage
# This stage installs ALL dependencies (including devDependencies)
# and runs tests. It's a "throwaway" stage — it won't exist in
# the final image.
# =============================================================
FROM node:22-alpine AS builder

# WHY alpine? Alpine Linux is a minimal Linux distro (~5MB).
# The standard node image is ~300MB. Smaller image = smaller
# attack surface. Fewer packages = fewer potential CVEs.

# Set working directory inside the container
# WHY /app? It's a convention. Don't put app code in / (root).
WORKDIR /app

# COPY package files FIRST, before source code
# WHY? Docker caches each layer. If you copy package.json first
# and run npm install, Docker caches that layer.
# The next time you build, if ONLY source files changed
# (not package.json), Docker reuses the cached node_modules layer.
# This makes builds MUCH faster.
COPY package*.json ./

# Install ALL dependencies (including devDependencies for testing)
# WHY --frozen-lockfile equivalent? npm ci:
#   - Installs exact versions from package-lock.json
#   - Fails if package-lock.json is out of sync
#   - Faster than npm install in CI environments
#   - Ensures reproducible builds
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/
COPY eslint.config.mjs ./

# Run tests inside Docker build
# WHY test during build? This ensures the Docker image is only
# built if tests pass. "Build" as the unit of truth.
# If tests fail here, Docker build fails — image is never created.
RUN npm test

# =============================================================
# STAGE 2: Production Stage
# This is the FINAL, MINIMAL image that gets deployed.
# It copies ONLY what's needed from the build stage.
# The build stage artifacts (devDependencies, tests) are DISCARDED.
# =============================================================
FROM node:22-alpine AS production

# WHY this label? Labels add metadata to the image.
# Useful for tracking which commit produced this image.
LABEL maintainer="DevSecOps Pipeline"
LABEL description="Secure Node.js API with DevSecOps pipeline"
LABEL version="1.0.0"

# Set NODE_ENV to production
# WHY? Many libraries have production optimizations behind this flag.
# Express disables verbose error messages, caches view templates, etc.
# Also disables devDependency installation.
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy ONLY package files for production install
COPY package*.json ./

# Install ONLY production dependencies
# WHY --omit=dev? Excludes jest, eslint, nodemon (~100MB saved)
# Fewer packages = smaller image = fewer potential vulnerabilities
RUN npm ci --omit=dev

# Copy source code from builder stage (NOT the entire build context)
COPY --from=builder /app/src ./src

# =============================================================
# SECURITY: Run as non-root user
# =============================================================
# WHY non-root?
# If a vulnerability in your app allows Remote Code Execution (RCE),
# the attacker inherits YOUR process's permissions.
#
# Root inside a container can:
#   - Modify system files
#   - Install malware
#   - Break out of the container in some configurations
#   - Access other containers on the same host
#
# A non-root user can only access its own files — damage is contained.
#
# node:alpine comes with a built-in 'node' user (UID 1000).
# We use it instead of creating a new one.
RUN chown -R node:node /app
USER node

# Document which port the app listens on
# WHY EXPOSE? It's documentation + integrates with Docker networking.
# It does NOT actually open the port (that happens with -p flag).
EXPOSE 3000

# =============================================================
# HEALTHCHECK
# WHY? Docker can automatically restart unhealthy containers.
# Docker Compose and Kubernetes use this to detect failures.
#
# Options:
#   --interval=30s    Check every 30 seconds
#   --timeout=10s     If the check takes >10s, it's failed
#   --start-period=5s Wait 5s before first check (app startup time)
#   --retries=3       Mark unhealthy after 3 consecutive failures
# =============================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
# WHY CMD vs ENTRYPOINT?
# CMD: Default command, can be overridden at runtime
# ENTRYPOINT: Cannot be overridden easily
# Best practice: use CMD for the start command so you can
# override it in CI/CD (e.g., to run tests against the container)
CMD ["node", "src/server.js"]
