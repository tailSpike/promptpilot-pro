// Base Jest configuration - runs all tests by default
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // Exclude main server file
    '!src/__tests__/**', // Exclude test files
    '!src/routes/**', // Exclude route handlers (thin layers) from unit coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70, // Lowered since we're excluding route handlers
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  testTimeout: 10000,
  // Suppress console output during tests for cleaner output
  silent: false,
  verbose: false,
  // Module mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Clear mocks between tests to prevent test pollution
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};