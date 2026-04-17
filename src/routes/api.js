/**
 * Sample API Routes
 *
 * WHY: This demonstrates a simple REST API that we'll secure and scan.
 * In a real app, these would connect to a database.
 * For this project, we use in-memory data to keep the focus on DevSecOps.
 */

const express = require('express');
const router = express.Router();

// In-memory "database" — replaced by a real DB in production
let tasks = [
  { id: 1, title: 'Set up CI/CD pipeline', completed: false, priority: 'high' },
  { id: 2, title: 'Add security scanning', completed: false, priority: 'high' },
  { id: 3, title: 'Deploy to cloud', completed: false, priority: 'medium' },
  { id: 4, title: 'Set up monitoring', completed: false, priority: 'low' },
];

let nextId = 5;

/**
 * GET /api/tasks
 * Returns all tasks
 *
 * SECURITY NOTE: In production, you'd add:
 *   - Authentication (JWT token verification)
 *   - Authorization (does this user own these tasks?)
 *   - Pagination (prevent returning millions of rows)
 */
router.get('/tasks', (req, res) => {
  // Support filtering by completion status
  const { completed, priority } = req.query;

  let filteredTasks = [...tasks];

  if (completed !== undefined) {
    filteredTasks = filteredTasks.filter(
      (t) => t.completed === (completed === 'true')
    );
  }

  if (priority) {
    filteredTasks = filteredTasks.filter((t) => t.priority === priority);
  }

  res.status(200).json({
    count: filteredTasks.length,
    tasks: filteredTasks,
  });
});

/**
 * GET /api/tasks/:id
 * Returns a single task by ID
 */
router.get('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  // SECURITY: Validate input — parseInt can return NaN
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID. Must be a number.' });
  }

  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ error: `Task with ID ${id} not found.` });
  }

  res.status(200).json(task);
});

/**
 * POST /api/tasks
 * Creates a new task
 *
 * SECURITY NOTE: We validate and sanitize all input.
 * Without validation, an attacker could:
 *   - Send massive payloads to crash the server
 *   - Inject malicious scripts in the title (Stored XSS)
 *   - Send unexpected data types to cause errors
 */
router.post('/tasks', (req, res) => {
  const { title, priority } = req.body;

  // Input validation
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Title is required and must be a string.' });
  }

  if (title.length > 200) {
    return res.status(400).json({ error: 'Title must be 200 characters or less.' });
  }

  // Sanitize: strip HTML tags to prevent Stored XSS
  const sanitizedTitle = title.replace(/<[^>]*>/g, '').trim();

  if (sanitizedTitle.length === 0) {
    return res.status(400).json({ error: 'Title cannot be empty after sanitization.' });
  }

  const validPriorities = ['low', 'medium', 'high'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

  const newTask = {
    id: nextId++,
    title: sanitizedTitle,
    completed: false,
    priority: taskPriority,
  };

  tasks.push(newTask);

  // 201 Created — the correct status code for resource creation
  res.status(201).json(newTask);
});

/**
 * PUT /api/tasks/:id
 * Updates an existing task
 */
router.put('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID. Must be a number.' });
  }

  const taskIndex = tasks.findIndex((t) => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: `Task with ID ${id} not found.` });
  }

  const { title, completed, priority } = req.body;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ error: 'Title must be a string of 200 chars or less.' });
    }
    tasks[taskIndex].title = title.replace(/<[^>]*>/g, '').trim();
  }

  if (completed !== undefined) {
    tasks[taskIndex].completed = Boolean(completed);
  }

  if (priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Priority must be low, medium, or high.' });
    }
    tasks[taskIndex].priority = priority;
  }

  res.status(200).json(tasks[taskIndex]);
});

/**
 * DELETE /api/tasks/:id
 * Deletes a task
 *
 * SECURITY NOTE: In production, verify the user owns this task
 * before allowing deletion (authorization check).
 */
router.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID. Must be a number.' });
  }

  const taskIndex = tasks.findIndex((t) => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: `Task with ID ${id} not found.` });
  }

  const deleted = tasks.splice(taskIndex, 1)[0];
  res.status(200).json({ message: 'Task deleted successfully.', task: deleted });
});

/**
 * GET /api/info
 * Returns API information
 *
 * SECURITY NOTE: Be careful what you expose here.
 * Never expose internal paths, database credentials, or stack traces.
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    name: 'Secure DevSecOps Pipeline API',
    version: '1.0.0',
    description: 'A task management API secured with DevSecOps best practices',
    endpoints: {
      'GET /api/tasks': 'List all tasks',
      'GET /api/tasks/:id': 'Get a specific task',
      'POST /api/tasks': 'Create a new task',
      'PUT /api/tasks/:id': 'Update a task',
      'DELETE /api/tasks/:id': 'Delete a task',
      'GET /health': 'Health check',
      'GET /ready': 'Readiness check',
    },
  });
});

// Export for testing — we also need to reset tasks between tests
module.exports = router;
module.exports.resetTasks = () => {
  tasks = [
    { id: 1, title: 'Set up CI/CD pipeline', completed: false, priority: 'high' },
    { id: 2, title: 'Add security scanning', completed: false, priority: 'high' },
    { id: 3, title: 'Deploy to cloud', completed: false, priority: 'medium' },
    { id: 4, title: 'Set up monitoring', completed: false, priority: 'low' },
  ];
  nextId = 5;
};
