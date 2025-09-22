// Jest configuration for integration tests
module.exports = {
  ...require('./jest.config.js'),
  testMatch: [
    '**/__tests__/integration-db/**/*.test.ts'
  ],
  testTimeout: 30000, // Longer timeout for database operations
  collectCoverage: false, // Don't collect coverage for integration tests
  displayName: 'Integration Tests (Database)',
  setupFilesAfterEnv: [],
  maxWorkers: 1 // Run integration tests sequentially to avoid database conflicts
};
