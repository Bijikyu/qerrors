module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    // Allow console.log statements as per user request
    'no-console': 'off',
    
    // Enforce consistent error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Security-focused rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Code quality rules - relaxed for legacy code
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'no-unused-expressions': 'warn',
    
    // Consistency rules - relaxed for legacy code
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always'],
    'indent': 'off',
    
    // Best practices for Node.js - relaxed
    'no-buffer-constructor': 'warn',
    'no-mixed-requires': 'warn',
    'no-new-require': 'warn',
    'no-path-concat': 'warn',
    
    // Performance considerations - relaxed
    'no-loop-func': 'warn',
    'no-inner-declarations': 'warn',
    
    // Additional relaxed rules for legacy compatibility
    'brace-style': 'warn',
    'no-prototype-builtins': 'warn',
    'promise/param-names': 'warn',
    'n/handle-callback-err': 'warn'
  },
  overrides: [
    {
      files: ['test/**/*.js', '*.test.js'],
      env: {
        mocha: true,
        jest: true
      },
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ]
};