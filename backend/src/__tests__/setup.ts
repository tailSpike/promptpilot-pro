// Test setup for PromptPilot Pro Backend
// This file configures the global test environment

// Suppress console errors in tests to avoid noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress JWT-related errors during testing
    const message = args[0]?.toString() || '';
    const allArgs = args.join(' ').toString();
    if (message.includes('jwt malformed') || 
        message.includes('JWT') || 
        message.includes('Authentication failed') ||
        message.includes('Get profile error') ||
        allArgs.includes('JsonWebTokenError') ||
        allArgs.includes('jwt malformed')) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});