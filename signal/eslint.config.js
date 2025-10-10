export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      // Prefer res.json()/res.send(); forbid direct res.end()
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='res'][property.name='end']",
          message: 'Use res.json()/res.send() for responses; avoid res.end() directly.'
        }
      ]
    }
  }
];

