# Secure DevSecOps CI/CD Pipeline

This project demonstrates a production-grade, end-to-end Secure DevSecOps CI/CD pipeline. It features a complete workflow that automatically tests, builds, secures, and deploys a Node.js application to an AWS EC2 instance, followed by real-time infrastructure and application monitoring.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Pipeline Stages](#pipeline-stages)
5. [Security Features](#security-features)
6. [Monitoring Stack](#monitoring-stack)
7. [Running Locally](#running-locally)

---

## Project Overview

The primary goal of this project is to implement "shift-left" security principles. By integrating security into the Continuous Integration and Continuous Deployment (CI/CD) pipeline, vulnerabilities are discovered and mitigated automatically before code reaches the production environment. 

The pipeline is entirely automated using GitHub Actions and deploys a containerized application to AWS.

## Architecture

This project is built using the following technology stack:

- **Application Backend:** Node.js with the Express framework
- **Containerization:** Docker (Multi-stage builds)
- **CI/CD Automation:** GitHub Actions
- **Static Security Scanning:** Trivy
- **Dynamic Security Testing (DAST):** OWASP ZAP (Zed Attack Proxy)
- **Infrastructure:** AWS EC2 (Ubuntu)
- **Observability Data Collector:** Prometheus
- **Observability Dashboards:** Grafana

## Prerequisites

To replicate or contribute to this project, you will need:
- A GitHub account for repository hosting and GitHub Actions.
- A Docker Hub account to store container images.
- An AWS account to host the EC2 instance.
- Node.js installed locally for development.

## Pipeline Stages

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) is divided into four sequential jobs that trigger upon pushing to the main branch:

### 1. Test and Lint
When code is pushed, the pipeline spins up an isolated Ubuntu runner. It installs the project dependencies, lints the codebase, and executes the unit testing suite using Jest. The pipeline will halt immediately if any tests fail, ensuring only functional code proceeds.

### 2. Docker Build and Static Analysis (Trivy)
If the tests pass, the pipeline builds a Docker image. Before the image is published, Aqua Security's Trivy scans the container's operating system layers and Node.js dependencies for known Common Vulnerabilities and Exposures (CVEs). If critical or high-severity vulnerabilities are found, the build process is terminated. 

Once the image is proven secure, it is pushed to Docker Hub.

### 3. Dynamic Application Security Testing (OWASP ZAP)
This stage focuses on runtime security. The pipeline briefly runs the application container and uses OWASP ZAP to actively probe the live application for misconfigurations, missing security headers, and common web flaws (such as Cross-Site Scripting).

### 4. Automated Deployment
After all security gates are successfully passed, the pipeline connects to the AWS EC2 instance securely via SSH. It pulls the latest scanned image from Docker Hub, gracefully shuts down the old container, and spins up the new secure container using Docker run with restart policies.

## Security Features

Security is enforced both in the pipeline and the application codebase:

- **Non-Root Docker Container:** The Dockerfile is configured to run the Node.js application as an unprivileged user (`node`), mitigating the impact of potential container escapes.
- **Helmet.js Configuration:** The Node.js application utilizes Helmet to automatically set secure HTTP response headers (e.g., Content-Security-Policy, X-Frame-Options).
- **Rate Limiting:** IP-based rate limiting is applied to all API routes to protect against brute-force attacks and simple Denial of Service (DoS) attempts.
- **Cross-Origin Resource Sharing (CORS):** Strict CORS policies are enforced to restrict which domains can interact with the API.

## Monitoring Stack

To achieve total observability in production, the application is instrumented to track its own performance:

- **Prom-Client Integration:** The Node.js application uses the official Prometheus client to expose a `/metrics` HTTP endpoint. This exposes metrics such as active connections, request duration percentiles, and memory utilization.
- **Prometheus Data Store:** A Prometheus container runs alongside the application on the EC2 instance, scraping system-level metrics (via Node Exporter) and application metrics every 15 seconds.
- **Grafana Visualization:** A Grafana container is used to read data from Prometheus and display the real-time health of the server and the custom application metrics via visual dashboards.

## Running Locally

To run the application on your local machine for development purposes:

1. Clone the repository:
   ```bash
   git clone https://github.com/YourUsername/secure-devsecops-pipeline.git
   cd secure-devsecops-pipeline
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm run start
   ```
   The application will become available at `http://localhost:3000`.

4. Run the local testing suite:
   ```bash
   npm test
   ```
