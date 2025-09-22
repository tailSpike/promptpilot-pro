import { PrismaClient } from '@prisma/client';

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
});

beforeEach(async () => {
  // Clean database before each test - order matters due to foreign keys
  try {
    await prisma.promptExecution.deleteMany();
  } catch {
    // Table might not exist yet
  }
  try {
    await prisma.workflowExecution.deleteMany();
  } catch {
    // Table might not exist yet
  }
  try {
    await prisma.workflowStep.deleteMany();
  } catch {
    // Table might not exist yet
  }
  try {
    await prisma.prompt.deleteMany();
  } catch {
    // Table might not exist yet
  }
  try {
    await prisma.workflow.deleteMany();
  } catch {
    // Table might not exist yet
  }
  try {
    await prisma.user.deleteMany();
  } catch {
    // Table might not exist yet
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };