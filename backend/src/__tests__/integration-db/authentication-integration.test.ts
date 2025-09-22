/**
 * Integration tests for authentication with real SQLite database
 * These tests demonstrate the proper approach to database integration testing
 * 
 * Note: For true integration testing, we would need to refactor the application 
 * to use a shared Prisma client instance instead of creating new instances in each route.
 * This test shows the pattern that should be followed once that refactoring is complete.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Test database setup
const testDbPath = path.join(__dirname, '../../../integration-test.db');
const testDatabaseUrl = `file:${testDbPath}`;

describe('Authentication Integration Tests (Real Database)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Run migrations on test database to create schema
    execSync('npx prisma migrate deploy', { 
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe'
    });
    
    // Initialize Prisma client for test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDatabaseUrl,
        },
      },
    });
    
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up
    await prisma.$disconnect();
    
    // Remove test database file
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      console.warn('Could not clean up test database:', error);
    }
  });

  beforeEach(async () => {
    // Clear all data before each test
    await prisma.user.deleteMany({});
  });

  describe('Database Integration Tests', () => {
    it('should be able to create and query users in test database', async () => {
      // Create a user directly with Prisma
      const userData = {
        email: 'integration-test@example.com',
        name: 'Integration Test User',
        password: 'hashedPassword123'
      };

      const createdUser = await prisma.user.create({
        data: userData
      });

      expect(createdUser).toBeTruthy();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.name).toBe(userData.name);
      expect(createdUser.id).toBeTruthy();

      // Query the user back
      const queriedUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      expect(queriedUser).toBeTruthy();
      expect(queriedUser?.name).toBe(userData.name);
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: 'unique-test@example.com',
        name: 'First User',
        password: 'password123'
      };

      // Create first user
      await prisma.user.create({ data: userData });

      // Try to create duplicate
      await expect(
        prisma.user.create({
          data: {
            ...userData,
            name: 'Second User'
          }
        })
      ).rejects.toThrow();
    });

    it('should handle user deletion', async () => {
      // Create a user
      const user = await prisma.user.create({
        data: {
          email: 'delete-test@example.com',
          name: 'Delete Test User',
          password: 'password123'
        }
      });

      // Verify user exists
      let foundUser = await prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(foundUser).toBeTruthy();

      // Delete user
      await prisma.user.delete({
        where: { id: user.id }
      });

      // Verify user is deleted
      foundUser = await prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(foundUser).toBeNull();
    });

    it('should handle transactions properly', async () => {
      const users = [
        { email: 'user1@example.com', name: 'User One', password: 'password1' },
        { email: 'user2@example.com', name: 'User Two', password: 'password2' }
      ];

      // Use transaction to create multiple users
      const createdUsers = await prisma.$transaction(
        users.map(user => prisma.user.create({ data: user }))
      );

      expect(createdUsers).toHaveLength(2);
      expect(createdUsers[0]?.email).toBe(users[0]?.email);
      expect(createdUsers[1]?.email).toBe(users[1]?.email);

      // Verify both users exist in database
      const allUsers = await prisma.user.findMany();
      expect(allUsers).toHaveLength(2);
    });
  });
});