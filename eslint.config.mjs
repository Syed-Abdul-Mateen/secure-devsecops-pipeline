/**
 * ESLint Configuration (Flat Config format — ESLint 9+)
 *
 * WHY we lint:
 *   - Catches bugs before runtime (undefined variables, unused imports)
 *   - Enforces consistent code style across the team
 *   - CI/CD pipeline runs this — inconsistent code blocks deployment
 *   - Security linting rules can catch potential vulnerabilities
 */

import js from '@eslint/js';

export default [
  // Apply recommended rules to all JS files
  js.configs.recommended,
  {
    // Configure for Node.js environment
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        // Jest globals
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      // Error prevention
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$' }],
      'no-console': 'off',  // We use console for logging in this project

      // Security-relevant rules
      'no-eval': 'error',           // eval() is a massive security risk
      'no-implied-eval': 'error',   // Prevents setTimeout("code") style eval
      'no-new-func': 'error',       // new Function("code") is also eval
    },
  },
  {
    // Ignore specific directories
    ignores: ['node_modules/', 'coverage/', 'dist/'],
  },
];
