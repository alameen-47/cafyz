module.exports = {
  root: true,
  env: { es2022: true, browser: true, node: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  ignorePatterns: [
    'node_modules/',
    'web-v2/dist/',
    'cap-android/',
    'cap-ios/',
    'backend/dist/',
    'releases/',
  ],
};
