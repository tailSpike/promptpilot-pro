import prisma from '../lib/prisma';
import { triggerService } from '../services/triggerService';

// Test setup for PromptPilot Pro Backend
// This file configures the global test environment

// Suppress console errors in tests to avoid noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress expected errors during testing
    const message = args[0]?.toString() || '';
    const allArgs = args.join(' ').toString();
    
    // JWT and authentication errors
    if (message.includes('jwt malformed') || 
        message.includes('JWT') || 
        message.includes('Authentication failed') ||
        message.includes('Get profile error') ||
        allArgs.includes('JsonWebTokenError') ||
        allArgs.includes('jwt malformed')) {
      return;
    }
    
    // Expected folder service errors during testing
    if (message.includes('folder with this name already exists') ||
        message.includes('Folder not found or access denied') ||
        message.includes('Moving folder would create a circular reference') ||
        allArgs.includes('Create folder error') ||
        allArgs.includes('Get folder error') ||
        allArgs.includes('Update folder error')) {
      return;
    }
    
    originalConsoleError(...args);
  };
});

afterAll(async () => {
  console.error = originalConsoleError;
  try {
    await triggerService.stopAllScheduledTriggers();
  } catch (error) {
    console.warn('⚠️  Warning: Failed to stop trigger service during test teardown:', error);
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.warn('⚠️  Warning: Failed to disconnect Prisma during test teardown:', error);
  }
});