// Flat config for ESLint (Node ESM)
// Enforces: no direct res.end() usage (except server/src/index.ts for HTML/streaming)

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      // Forbid direct res.end to enforce sendOk/sendError usage
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='res'][property.name='end']",
          message: 'Use sendOk/sendError or streaming helpers; avoid res.end() directly.'
        }
      ]
    }
  },
  {
    files: ['src/index.ts'],
    rules: {
      // Allow res.end in dashboard HTML and download streaming
      'no-restricted-syntax': 'off'
    }
  }
];

