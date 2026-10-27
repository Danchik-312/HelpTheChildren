export default [{
  files: ['src/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
  languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly' } },
  rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'no-undef': 'error', 'no-constant-condition': 'error' },
}];
