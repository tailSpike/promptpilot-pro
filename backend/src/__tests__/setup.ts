import { PrismaClient } from '@prisma/client';

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
});

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

beforeEach(async () => {
  // Clean database before each test
  await prisma.promptExecution.deleteMany();
  await prisma.workflowExecution.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.prompt.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };