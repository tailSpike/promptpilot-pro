// Jest configuration for unit tests only
module.exports = {
  ...require('./jest.config.js'),
  testMatch: [
    '**/__tests__/services/**/*.test.ts',
    '**/__tests__/middleware/**/*.test.ts',
    '**/__tests__/unit/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/__tests__/integration-db/',
    '<rootDir>/src/__tests__/integration/',
    '<rootDir>/src/__tests__/api/'
  ],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/middleware/**/*.ts',
    'src/lib/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    }
  },
  displayName: 'Unit Tests'
};
