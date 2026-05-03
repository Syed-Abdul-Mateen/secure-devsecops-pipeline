# Secure DevSecOps CI/CD Pipeline

A production-grade, end-to-end CI/CD pipeline that automates the testing, security scanning, containerization, deployment, and monitoring of a Node.js web application. This project demonstrates the practical implementation of "shift-left" security by embedding static analysis, dynamic application security testing, and runtime hardening directly into the software delivery lifecycle.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Diagram](#architecture-diagram)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [What Was Built and How](#what-was-built-and-how)
  - [1. Secure Node.js Application](#1-secure-nodejs-application)
  - [2. Containerization with Docker](#2-containerization-with-docker)
  - [3. CI/CD Pipeline with GitHub Actions](#3-cicd-pipeline-with-github-actions)
  - [4. Security Scanning](#4-security-scanning)
  - [5. Automated Deployment to AWS EC2](#5-automated-deployment-to-aws-ec2)
  - [6. Monitoring with Prometheus and Grafana](#6-monitoring-with-prometheus-and-grafana)
- [Pipeline Workflow](#pipeline-workflow)
- [Application Security Controls](#application-security-controls)
- [API Endpoints](#api-endpoints)
- [Running Locally](#running-locally)
  - [Option A: Run Directly with Node.js](#option-a-run-directly-with-nodejs)
  - [Option B: Run with Docker](#option-b-run-with-docker)
  - [Option C: Run with Docker Compose](#option-c-run-with-docker-compose)
- [Running the Tests](#running-the-tests)
- [Environment Variables](#environment-variables)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [License](#license)

---

## Project Overview

Modern software delivery demands that security is not an afterthought bolted onto the end of a release cycle, but a continuous, automated process embedded at every stage. This project implements that principle across six integrated phases:

1. A hardened Node.js REST API with layered security middleware.
2. A multi-stage Docker build that produces a minimal, non-root production image.
3. A four-job GitHub Actions pipeline that gates every deployment behind automated tests and security scans.
4. Static container scanning with Trivy and dynamic application testing with OWASP ZAP.
5. Zero-downtime deployment to an AWS EC2 instance via SSH.
6. Real-time infrastructure and application monitoring using Prometheus and Grafana.

The pipeline triggers on every push to the `main` or `develop` branch and on pull requests targeting `main`. Deployment and DAST scanning execute exclusively on the `main` branch.

---

## Architecture Diagram

```
Developer Workstation
        |
        | git push
        v
+--------------------+
|   GitHub Actions   |
|                    |
|  Job 1: Test       |  --> Lint + Unit Tests (Jest, ESLint)
|  Job 2: Build      |  --> Docker Build + Trivy CVE Scan
|  Job 3: DAST       |  --> OWASP ZAP Baseline Scan
|  Job 4: Deploy     |  --> SSH into EC2, pull and run container
+--------------------+
        |
        | docker pull + docker run
        v
+--------------------+       +--------------------+       +-------------------+
|   AWS EC2 (Ubuntu) |       |    Prometheus      |       |      Grafana      |
|                    | <---- |  (Scrapes /metrics |       | (Visualizes data  |
|  Node.js App       |       |   every 15s)       | ----> |  from Prometheus) |
|  Port 80 -> 3000   |       |  Port 9090         |       |  Port 3001        |
+--------------------+       +--------------------+       +-------------------+
```

---

## Technology Stack

| Layer                  | Technology                           | Purpose                                                    |
|------------------------|--------------------------------------|------------------------------------------------------------|
| Application Runtime    | Node.js 22, Express 4                | REST API server                                            |
| Security Middleware    | Helmet, express-rate-limit, CORS     | HTTP header hardening, rate limiting, origin restriction   |
| Testing                | Jest, Supertest                      | Unit testing with HTTP assertion support                   |
| Linting                | ESLint 9 (flat config)               | Static code analysis and style enforcement                 |
| Containerization       | Docker (multi-stage, Alpine-based)   | Minimal, secure production images                          |
| Container Orchestration| Docker Compose                       | Local multi-container development environment              |
| CI/CD                  | GitHub Actions                       | Automated pipeline with four sequential jobs               |
| Static Security Scan   | Trivy (Aqua Security)                | CVE scanning of OS packages and Node.js dependencies       |
| Dynamic Security Test  | OWASP ZAP (Zed Attack Proxy)         | Runtime vulnerability scanning against a live application  |
| Infrastructure         | AWS EC2 (Ubuntu)                     | Production hosting                                         |
| Metrics Collection     | Prometheus, prom-client              | Time-series metrics scraping and storage                   |
| Metrics Visualization  | Grafana                              | Dashboard-based monitoring and alerting                    |
| Request Logging        | Morgan                               | HTTP request audit logging                                 |

---

## Project Structure

```
secure-devsecops-pipeline/
|-- .github/
|   └-- workflows/
|       └-- ci-cd.yml                  # GitHub Actions pipeline (4 jobs)
|-- .zap/
|   └-- rules.tsv                     # OWASP ZAP scan rule configuration
|-- monitoring/
|   |-- docker-compose.monitoring.yml  # Prometheus + Grafana stack
|   └-- prometheus.yml                 # Prometheus scrape configuration
|-- src/
|   |-- app.js                         # Express application setup and middleware registration
|   |-- server.js                      # Server entry point with graceful shutdown
|   |-- middleware/
|   |   |-- security.js                # Helmet, CORS, rate limiter, Morgan configuration
|   |   └-- metrics.js                 # Prometheus metrics collection middleware
|   └-- routes/
|       |-- api.js                     # REST API routes (CRUD for tasks)
|       └-- health.js                  # Liveness and readiness probe endpoints
|-- tests/
|   └-- app.test.js                    # Unit test suite (Jest + Supertest)
|-- .dockerignore                      # Files excluded from Docker build context
|-- .env.example                       # Environment variable template
|-- .trivyignore                       # CVEs to suppress in Trivy scans
|-- Dockerfile                         # Multi-stage Docker build
|-- docker-compose.yml                 # Local development container configuration
|-- eslint.config.mjs                  # ESLint 9 flat configuration
|-- package.json                       # Dependencies and scripts
└-- package-lock.json                  # Locked dependency tree
```

---

## What Was Built and How

### 1. Secure Node.js Application

Built a REST API using Express that serves as the deployable workload for the pipeline. The application separates concerns into distinct modules:

- **`src/app.js`** defines the Express application, registers middleware in the correct order (security headers first, then metrics tracking, then routes), and includes a global error handler that suppresses stack traces in production to prevent information leakage.
- **`src/server.js`** handles the server lifecycle, including graceful shutdown on `SIGTERM` and `SIGINT` signals. This ensures that when Docker stops the container, all in-flight requests complete before the process exits.
- **`src/middleware/security.js`** configures four security layers: Helmet for HTTP response headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security), express-rate-limit to cap each IP at 100 requests per 15-minute window, CORS to restrict cross-origin access, and Morgan for request audit logging.
- **`src/middleware/metrics.js`** instruments the application with three custom Prometheus metrics: a counter for total HTTP requests (labeled by method, route, and status code), a histogram for request duration distribution (with buckets at 50ms through 5s for percentile calculations), and a gauge for active connections.
- **`src/routes/api.js`** implements a full CRUD task management API with input validation, length limits, HTML tag sanitization to prevent stored XSS, and safe error responses.
- **`src/routes/health.js`** exposes `/health` (liveness probe) and `/ready` (readiness probe) endpoints used by Docker health checks, load balancers, and the CI/CD pipeline to verify deployment success.

### 2. Containerization with Docker

Created a multi-stage Dockerfile that produces a minimal production image:

- **Stage 1 (Builder):** Uses `node:22-alpine` as the base. Installs all dependencies including devDependencies, copies source and test files, and runs the full test suite inside the build. If tests fail, the image is never created.
- **Stage 2 (Production):** Starts from a fresh `node:22-alpine` base. Installs only production dependencies (`npm ci --omit=dev`), copies only the `src/` directory from the builder stage, and discards all build tools, test files, and devDependencies. The final image runs as the non-root `node` user (UID 1000) to contain the blast radius of any potential container escape. A health check is configured to allow Docker to automatically detect and restart unhealthy containers.

A `docker-compose.yml` file is provided for local development, with resource limits (0.5 CPU, 256MB memory), restart policies, and network isolation.

### 3. CI/CD Pipeline with GitHub Actions

The pipeline is defined in `.github/workflows/ci-cd.yml` and consists of four sequential jobs:

- **Job 1 -- Test and Lint:** Checks out the code on an Ubuntu runner, sets up Node.js 22 with npm caching, installs dependencies using `npm ci` for reproducible builds, runs ESLint for static analysis, and executes the Jest test suite with code coverage. Coverage reports are uploaded as pipeline artifacts and retained for 7 days.
- **Job 2 -- Docker Build and Trivy Scan:** Builds the Docker image using Docker Buildx with GitHub Actions cache for faster rebuilds. Runs Aqua Security Trivy against the built image, scanning both OS-level packages and Node.js library dependencies for known CVEs. Results are uploaded to the GitHub Security tab in SARIF format. If any CRITICAL or HIGH severity vulnerabilities are found (excluding those listed in `.trivyignore`), the build fails. On success, the image is tagged with both `latest` and the Git commit SHA and pushed to Docker Hub.
- **Job 3 -- OWASP ZAP DAST Scan:** Pulls the image that was just pushed to Docker Hub, runs it as a container, waits for the health check to pass, and then executes an OWASP ZAP baseline scan against the live application. ZAP probes for missing security headers, misconfigurations, and common web vulnerabilities. The HTML scan report is uploaded as a pipeline artifact.
- **Job 4 -- Deploy to AWS EC2:** Connects to the EC2 instance via SSH using credentials stored in GitHub Secrets, pulls the latest image from Docker Hub, stops and removes the previous container, starts the new container with a restart policy and port mapping (host port 80 to container port 3000), verifies the deployment by hitting the `/health` endpoint, and prunes unused images to reclaim disk space.

### 4. Security Scanning

Two complementary security scanning approaches are used:

- **Trivy (Static Analysis):** Scans the Docker image layers and the `node_modules` dependency tree for published CVEs. This catches known vulnerabilities in third-party packages and operating system libraries before the image is published.
- **OWASP ZAP (Dynamic Analysis):** Performs an automated baseline scan against the running application. This tests for runtime issues that static analysis cannot detect, such as missing HTTP security headers, insecure cookie configurations, and application-level misconfigurations.

### 5. Automated Deployment to AWS EC2

The deployment job uses the `appleboy/ssh-action` GitHub Action to execute commands on the EC2 instance over SSH. The deployment process pulls the scanned image, performs a rolling replacement of the running container, and validates the deployment with a health check. The container is configured with `--restart unless-stopped` to automatically recover from crashes.

### 6. Monitoring with Prometheus and Grafana

The monitoring stack is defined in `monitoring/docker-compose.monitoring.yml`:

- **Application Instrumentation:** The Node.js application uses the `prom-client` library to expose a `/metrics` endpoint in Prometheus text format. Default Node.js runtime metrics (CPU usage, memory allocation, garbage collection duration, event loop lag) are collected automatically. Three custom metrics track HTTP request volume, latency distribution, and connection concurrency.
- **Prometheus:** Runs as a container alongside the application, scraping the `/metrics` endpoint every 15 seconds. Also scrapes its own internal metrics and Node Exporter for system-level host metrics (CPU, RAM, disk). Data is retained for 200 hours.
- **Grafana:** Connects to Prometheus as a data source and provides dashboard-based visualization. Accessible on port 3001 with configurable admin credentials via environment variables.

---

## Pipeline Workflow

The following sequence executes on every push to `main`:

```
Push to main
    |
    v
[Job 1] Test and Lint
    |-- npm ci
    |-- eslint src/ tests/
    |-- jest --coverage --forceExit
    |-- Upload coverage artifact
    |
    v (passes)
[Job 2] Docker Build + Trivy Scan
    |-- docker build (multi-stage)
    |-- trivy scan (CRITICAL, HIGH)
    |-- Upload SARIF to GitHub Security
    |-- docker push to Docker Hub
    |
    v (passes)
[Job 3] OWASP ZAP DAST Scan
    |-- docker run (target application)
    |-- zap-baseline scan
    |-- Upload HTML report
    |
    v (passes)
[Job 4] Deploy to AWS EC2
    |-- SSH into EC2
    |-- docker pull latest
    |-- docker stop + rm old container
    |-- docker run new container
    |-- curl /health (verify deployment)
    |-- docker image prune
```

---

## Application Security Controls

| Control                    | Implementation                                       | Threat Mitigated                                |
|----------------------------|------------------------------------------------------|-------------------------------------------------|
| HTTP Security Headers      | Helmet.js with strict CSP directives                 | XSS, clickjacking, MIME sniffing                |
| Rate Limiting              | express-rate-limit (100 req/15 min per IP)           | Brute-force attacks, basic DoS                  |
| CORS Policy                | Configurable allowed origins via environment         | Cross-site request forgery                      |
| Non-Root Container         | Dockerfile USER directive (node, UID 1000)           | Container escape privilege escalation           |
| Input Validation           | Type checking, length limits on all API inputs       | Injection, buffer overflow                      |
| HTML Sanitization          | Regex-based tag stripping on user inputs             | Stored XSS                                      |
| Request Body Size Limit    | express.json({ limit: '10kb' })                      | Large payload DoS                               |
| Error Response Suppression | Global error handler hides stack traces in production| Information disclosure                          |
| Payload Size Limit         | JSON and URL-encoded body limits                     | Resource exhaustion                             |
| Security Audit Logging     | Morgan request logger (combined format in production)| Incident investigation, compliance              |

---

## API Endpoints

| Method | Path              | Description                               |
|--------|-------------------|-------------------------------------------|
| GET    | `/`               | Root endpoint, returns API status         |
| GET    | `/health`         | Liveness probe (uptime, memory usage)     |
| GET    | `/ready`          | Readiness probe (dependency health)       |
| GET    | `/metrics`        | Prometheus metrics (text format)          |
| GET    | `/api/info`       | API documentation and available endpoints |
| GET    | `/api/tasks`      | List all tasks (supports query filters)   |
| GET    | `/api/tasks/:id`  | Retrieve a single task by ID              |
| POST   | `/api/tasks`      | Create a new task                         |
| PUT    | `/api/tasks/:id`  | Update an existing task                   |
| DELETE | `/api/tasks/:id`  | Delete a task                             |

---

## Running Locally

### Prerequisites

Before proceeding, install the following software on your machine:

| Software   | Minimum Version | Download Link                                  | Verification Command     |
|------------|-----------------|-------------------------------------------------|--------------------------|
| Git        | 2.x      -      | https://git-scm.com/downloads                  | `git --version`          |
| Node.js    | 18.x (LTS recommended: 22.x) | https://nodejs.org/              | `node --version`         |
| npm        | (bundled with Node.js)        | (installed with Node.js)         | `npm --version`          |
| Docker     | 20.x (only for Options B and C) | https://www.docker.com/get-started | `docker --version`     |

After installing each tool, open a new terminal window and run the verification command listed above to confirm the installation was successful.

---

### Option A: Run Directly with Node.js

This is the simplest approach. No Docker required.

**Step 1: Clone the repository.**

```bash
git clone https://github.com/Syed-Abdul-Mateen/secure-devsecops-pipeline.git
```

**Step 2: Navigate into the project directory.**

```bash
cd secure-devsecops-pipeline
```

**Step 3: Create the environment file.**

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env
```

On Windows Command Prompt, use:

```cmd
copy .env.example .env
```

The default values in `.env.example` are preconfigured for local development. No changes are required to run the application locally.

**Step 4: Install dependencies.**

```bash
npm ci
```

This installs the exact dependency versions specified in `package-lock.json`. If this command fails, use `npm install` instead.

**Step 5: Start the application.**

```bash
npm run start
```

**Step 6: Verify the application is running.**

Open a browser and navigate to:

```
http://localhost:3000
```

You should see a JSON response containing the API status. You can also verify the health endpoint:

```
http://localhost:3000/health
```

To stop the server, press `Ctrl+C` in the terminal.

---

### Option B: Run with Docker

This builds and runs the application inside a Docker container, identical to the production environment.

**Step 1: Clone the repository.**

```bash
git clone https://github.com/Syed-Abdul-Mateen/secure-devsecops-pipeline.git
cd secure-devsecops-pipeline
```

**Step 2: Build the Docker image.**

```bash
docker build -t secure-devsecops-app .
```

This executes the multi-stage build, runs the test suite inside the container, and produces a production-ready image. The build will fail if any test fails.

**Step 3: Run the container.**

```bash
docker run -d -p 3000:3000 --name secure-app secure-devsecops-app
```

**Step 4: Verify the container is running.**

```bash
docker ps
```

You should see `secure-app` listed with status `Up`. Navigate to `http://localhost:3000` in a browser.

**Step 5: View application logs.**

```bash
docker logs -f secure-app
```

**Step 6: Stop and remove the container.**

```bash
docker stop secure-app
docker rm secure-app
```

---

### Option C: Run with Docker Compose

This is the recommended approach for local development. It applies resource limits and network isolation matching the production configuration.

**Step 1: Clone the repository.**

```bash
git clone https://github.com/Syed-Abdul-Mateen/secure-devsecops-pipeline.git
cd secure-devsecops-pipeline
```

**Step 2: Create the environment file.**

```bash
cp .env.example .env
```

**Step 3: Start the application.**

```bash
docker compose up --build
```

Add the `-d` flag to run in the background:

```bash
docker compose up --build -d
```

**Step 4: Verify the application.**

Navigate to `http://localhost:3000` in a browser.

**Step 5: Stop the application.**

```bash
docker compose down
```

---

## Running the Tests

The test suite validates health endpoints, security headers, API CRUD operations, input validation, XSS sanitization, and error handling.

**Run all tests with coverage:**

```bash
npm test
```

**Run tests in watch mode during development:**

```bash
npm run test:watch
```

**Run the linter:**

```bash
npm run lint
```

Expected output on a clean run: all tests pass with a minimum of 50% code coverage across branches, functions, lines, and statements.

---

## Environment Variables

| Variable                  | Default        | Description                                              |
|---------------------------|----------------|----------------------------------------------------------|
| `NODE_ENV`                | `development`  | Runtime environment (`development` or `production`)      |
| `PORT`                    | `3000`         | Port the server listens on                               |
| `ALLOWED_ORIGINS`         | `*`            | Comma-separated list of allowed CORS origins             |
| `RATE_LIMIT_WINDOW_MS`   | `900000`       | Rate limit window in milliseconds (default: 15 minutes)  |
| `RATE_LIMIT_MAX_REQUESTS`| `100`          | Maximum requests per IP per window                       |
| `DOCKER_USERNAME`         | --             | Docker Hub username (used in CI/CD and monitoring stack) |
| `GRAFANA_USER`            | `admin`        | Grafana admin username                                   |
| `GRAFANA_PASSWORD`        | `changeme`     | Grafana admin password                                   |

---

## GitHub Secrets Configuration

The following secrets must be configured in the GitHub repository under Settings > Secrets and variables > Actions for the CI/CD pipeline to function:

| Secret Name        | Description                                              |
|--------------------|----------------------------------------------------------|
| `DOCKER_USERNAME`  | Docker Hub account username                              |
| `DOCKER_PASSWORD`  | Docker Hub account password or access token              |
| `EC2_HOST`         | Public IP address or hostname of the AWS EC2 instance    |
| `EC2_USERNAME`     | SSH username for the EC2 instance (typically `ubuntu`)   |
| `EC2_PRIVATE_KEY`  | Full contents of the SSH private key file (.pem)         |

---

## License

This project is licensed under the MIT License.
