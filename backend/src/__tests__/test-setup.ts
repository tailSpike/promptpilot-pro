// Mock Prisma Client to prevent actual database calls during tests
jest.mock('../generated/prisma/client');

import { PrismaClient } from '../generated/prisma/client';

// Create a mocked prisma instance for use in tests
const prisma = new PrismaClient();

// Helper function to set up common mock implementations
export const setupMockPrisma = () => {
  // Set up default mock implementations that return empty results
  (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.prompt.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.workflow.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.workflowStep.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.promptExecution.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.workflowExecution.findMany as jest.Mock).mockResolvedValue([]);
  
  // Mock deleteMany to return success
  (prisma.user.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.prompt.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.workflow.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.workflowStep.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.promptExecution.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.workflowExecution.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  
  // Mock common CRUD operations
  (prisma.user.create as jest.Mock).mockImplementation((data) => 
    Promise.resolve({ id: 'mock-user-id', ...data.data })
  );
  (prisma.prompt.create as jest.Mock).mockImplementation((data) => 
    Promise.resolve({ id: 'mock-prompt-id', ...data.data })
  );
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.prompt.findUnique as jest.Mock).mockResolvedValue(null);
};

export { prisma };