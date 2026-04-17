/**
 * Unit Tests for the DevSecOps Pipeline API
 *
 * WHY we test:
 *   - Catch bugs before they reach production
 *   - Verify security controls work (input validation, sanitization)
 *   - CI/CD pipeline runs these automatically — broken tests block deployment
 *   - Gives confidence when refactoring code
 *
 * We use:
 *   - Jest: Test framework (assertions, mocking, coverage)
 *   - Supertest: Makes HTTP requests to our Express app without starting a server
 */

const request = require('supertest');
const app = require('../src/app');
const { resetTasks } = require('../src/routes/api');

// Reset our in-memory database before each test
// WHY: Tests must be independent. If test A creates data,
// it shouldn't affect test B. This is called "test isolation".
beforeEach(() => {
  resetTasks();
});

// ============================================
// Health Check Tests
// ============================================
describe('Health Check Endpoints', () => {
  test('GET /health should return 200 and healthy status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('memory');
  });

  test('GET /ready should return 200 and ready status', async () => {
    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body).toHaveProperty('checks');
  });
});

// ============================================
// Security Header Tests
// WHY: Verify our Helmet configuration actually works.
// If these fail, our app is missing critical security headers.
// ============================================
describe('Security Headers', () => {
  test('should include security headers in responses', async () => {
    const response = await request(app).get('/health');

    // X-Content-Type-Options prevents MIME type sniffing
    expect(response.headers['x-content-type-options']).toBe('nosniff');

    // X-Frame-Options prevents clickjacking
    expect(response.headers['x-frame-options']).toBeDefined();

    // X-Powered-By should be REMOVED (hides Express from attackers)
    expect(response.headers['x-powered-by']).toBeUndefined();

    // Content-Security-Policy should be set
    expect(response.headers['content-security-policy']).toBeDefined();
  });
});

// ============================================
// Root Route Tests
// ============================================
describe('Root Route', () => {
  test('GET / should return API info', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Secure DevSecOps');
    expect(response.body.status).toBe('running');
  });
});

// ============================================
// API Route Tests
// ============================================
describe('Task API Endpoints', () => {
  // --- GET /api/tasks ---
  describe('GET /api/tasks', () => {
    test('should return all tasks', async () => {
      const response = await request(app).get('/api/tasks');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(4);
      expect(response.body.tasks).toHaveLength(4);
    });

    test('should filter tasks by priority', async () => {
      const response = await request(app).get('/api/tasks?priority=high');

      expect(response.status).toBe(200);
      expect(response.body.tasks.every((t) => t.priority === 'high')).toBe(true);
    });
  });

  // --- GET /api/tasks/:id ---
  describe('GET /api/tasks/:id', () => {
    test('should return a specific task', async () => {
      const response = await request(app).get('/api/tasks/1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.title).toBeDefined();
    });

    test('should return 404 for non-existent task', async () => {
      const response = await request(app).get('/api/tasks/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    test('should return 400 for invalid ID', async () => {
      const response = await request(app).get('/api/tasks/abc');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
  });

  // --- POST /api/tasks ---
  describe('POST /api/tasks', () => {
    test('should create a new task', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'New test task', priority: 'high' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New test task');
      expect(response.body.priority).toBe('high');
      expect(response.body.completed).toBe(false);
      expect(response.body.id).toBeDefined();
    });

    test('should reject task without title', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ priority: 'high' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Title is required');
    });

    test('should reject title longer than 200 chars', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'A'.repeat(201) });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('200 characters');
    });

    /**
     * SECURITY TEST: XSS Prevention
     * WHY: If an attacker sends HTML/JavaScript as the title,
     * and we store it without sanitization, it becomes a
     * "Stored XSS" vulnerability. When another user views it,
     * the script executes in their browser.
     */
    test('should sanitize HTML tags from title (XSS prevention)', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: '<script>alert("xss")</script>Clean Title' });

      expect(response.status).toBe(201);
      // The <script> tags should be stripped
      expect(response.body.title).toBe('alert("xss")Clean Title');
      expect(response.body.title).not.toContain('<script>');
    });

    test('should default priority to medium for invalid values', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test task', priority: 'invalid' });

      expect(response.status).toBe(201);
      expect(response.body.priority).toBe('medium');
    });
  });

  // --- PUT /api/tasks/:id ---
  describe('PUT /api/tasks/:id', () => {
    test('should update an existing task', async () => {
      const response = await request(app)
        .put('/api/tasks/1')
        .send({ title: 'Updated title', completed: true });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated title');
      expect(response.body.completed).toBe(true);
    });

    test('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/999')
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  // --- DELETE /api/tasks/:id ---
  describe('DELETE /api/tasks/:id', () => {
    test('should delete a task', async () => {
      const response = await request(app).delete('/api/tasks/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify it's actually gone
      const getResponse = await request(app).get('/api/tasks/1');
      expect(getResponse.status).toBe(404);
    });

    test('should return 404 for non-existent task', async () => {
      const response = await request(app).delete('/api/tasks/999');

      expect(response.status).toBe(404);
    });
  });
});

// ============================================
// 404 Handler Tests
// ============================================
describe('404 Handler', () => {
  test('should return 404 for undefined routes', async () => {
    const response = await request(app).get('/this-route-does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(response.body.suggestion).toContain('/api/info');
  });
});

// ============================================
// API Info Tests
// ============================================
describe('API Info', () => {
  test('GET /api/info should return API documentation', async () => {
    const response = await request(app).get('/api/info');

    expect(response.status).toBe(200);
    expect(response.body.name).toContain('DevSecOps');
    expect(response.body.endpoints).toBeDefined();
  });
});
