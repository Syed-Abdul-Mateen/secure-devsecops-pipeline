# 🔐 Secure DevSecOps Pipeline

A production-grade CI/CD pipeline demonstrating DevSecOps best practices, built with Node.js, Docker, GitHub Actions, and AWS.

![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions)
![Security](https://img.shields.io/badge/Security-Trivy%20%2B%20OWASP%20ZAP-green)
![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker)
![AWS](https://img.shields.io/badge/Cloud-AWS%20EC2-FF9900?logo=amazon-aws)
![Monitoring](https://img.shields.io/badge/Monitoring-Prometheus%20%2B%20Grafana-E6522C?logo=prometheus)

## 🏗️ Architecture

```
Developer Push → GitHub Actions CI/CD → Lint & Test → Docker Build
     → Trivy Scan → OWASP ZAP DAST → Push to Docker Hub
     → Deploy to AWS EC2 → Prometheus Metrics → Grafana Dashboard
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Docker Desktop
- Git

### Local Development
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/secure-devsecops-pipeline.git
cd secure-devsecops-pipeline

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Run in development mode
npm run dev

# Run tests
npm test

# Run linter
npm run lint
```

### Docker
```bash
# Build the image
docker build -t secure-app .

# Run the container
docker run -p 3000:3000 secure-app
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API landing page |
| GET | `/health` | Liveness probe |
| GET | `/ready` | Readiness probe |
| GET | `/api/info` | API documentation |
| GET | `/api/tasks` | List all tasks |
| GET | `/api/tasks/:id` | Get specific task |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

## 🔒 Security Features

- **Helmet.js** — HTTP security headers (CSP, X-Frame-Options, HSTS)
- **Rate Limiting** — DDoS/brute-force protection (100 req/15min)
- **CORS** — Cross-origin request control
- **Input Validation** — Type checking, length limits, sanitization
- **XSS Prevention** — HTML tag stripping on user input
- **Error Handling** — No stack traces leaked to clients
- **Non-root Docker** — Container runs as unprivileged user
- **Trivy Scanning** — CVE detection in container images
- **OWASP ZAP** — Dynamic application security testing

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Watch mode for development
npm run test:watch
```

## 📊 Monitoring

- **Prometheus** — Metrics collection at `/metrics`
- **Grafana** — Visual dashboards for HTTP metrics, system health

## 📁 Project Structure

```
secure-devsecops-pipeline/
├── .github/workflows/     # CI/CD pipeline definitions
├── src/
│   ├── app.js             # Express application setup
│   ├── server.js          # Server entry point
│   ├── routes/
│   │   ├── health.js      # Health check endpoints
│   │   └── api.js         # REST API routes
│   └── middleware/
│       └── security.js    # Security middleware config
├── tests/
│   └── app.test.js        # Unit tests
├── monitoring/            # Prometheus & Grafana config
├── Dockerfile             # Multi-stage production build
├── docker-compose.yml     # Local development
└── README.md
```

## 📜 License

MIT
