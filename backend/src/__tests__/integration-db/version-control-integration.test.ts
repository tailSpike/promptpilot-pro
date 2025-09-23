/**
 * Integration tests for Version Control System with real SQLite database
 * These tests validate the complete end-to-end version control workflow
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { VersionService, VersionChangeType } from '../../services/versionService';

// Test database setup
const testDbPath = path.join(__dirname, '../../../version-control-test.db');
const testDatabaseUrl = `file:${testDbPath}`;

describe('Version Control Integration Tests (Real Database)', () => {
  let prisma: PrismaClient;
  let testUserId: string;
  let testPromptId: string;

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

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        name: 'Version Control Test User',
        email: 'version-test@example.com',
        password: 'test-password-hash',
      },
    });
    testUserId = testUser.id;

    // Create test prompt
    const testPrompt = await prisma.prompt.create({
      data: {
        name: 'Version Control Test Prompt',
        description: 'A prompt for testing version control functionality',
        content: 'Hello {{name}}, welcome to our {{platform}}!',
        variables: [
          { name: 'name', type: 'text', description: 'User name' },
          { name: 'platform', type: 'text', description: 'Platform name' },
        ],
        metadata: { category: 'greeting' },
        isPublic: false,
        createdById: testUserId,
      },
    });
    testPromptId = testPrompt.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.$disconnect();
    
    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Clean up versions between tests
    await prisma.promptVersion.deleteMany({
      where: { promptId: testPromptId },
    });
  });

  describe('Version Creation', () => {
    it('should create the first version as 1.0.0', async () => {
      const prompt = await prisma.prompt.findUnique({
        where: { id: testPromptId },
      });

      expect(prompt).toBeDefined();

      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Initial version of the greeting prompt',
      });

      expect(version).toBeDefined();
      expect(version.version).toBe('1.0.0');
      expect(version.majorVersion).toBe(1);
      expect(version.minorVersion).toBe(0);
      expect(version.patchVersion).toBe(0);
      expect(version.commitMessage).toBe('Initial version of the greeting prompt');
      expect(version.changeType).toBe('MAJOR');
      expect(version.promptId).toBe(testPromptId);
      expect(version.createdById).toBe(testUserId);
    });

    it('should increment version numbers correctly for different change types', async () => {
      // Create initial version
      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Initial version',
      });

      // Create patch version
      const patchVersion = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.PATCH,
        commitMessage: 'Bug fix',
      });

      expect(patchVersion.version).toBe('1.0.1');

      // Create minor version
      const minorVersion = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MINOR,
        commitMessage: 'New feature',
      });

      expect(minorVersion.version).toBe('1.1.0');

      // Create major version
      const majorVersion = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Breaking change',
      });

      expect(majorVersion.version).toBe('2.0.0');
    });

    it('should store complete prompt snapshot in version', async () => {
      const prompt = await prisma.prompt.findUnique({
        where: { id: testPromptId },
      });

      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Initial version with full snapshot',
      });

      expect(version.name).toBe(prompt?.name);
      expect(version.description).toBe(prompt?.description);
      expect(version.content).toBe(prompt?.content);
      expect(version.variables).toEqual(prompt?.variables);
      expect(version.metadata).toEqual(prompt?.metadata);
      expect(version.isPublic).toBe(prompt?.isPublic);
    });
  });

  describe('Version History', () => {
    it('should retrieve version history in correct order', async () => {
      // Create multiple versions
      const version1 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'First version',
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const version2 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.PATCH,
        commitMessage: 'Second version',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const version3 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MINOR,
        commitMessage: 'Third version',
      });

      const history = await VersionService.getVersionHistory(testPromptId);

      expect(history).toHaveLength(3);
      
      // Should be ordered by creation date descending (newest first)
      expect(history[0].id).toBe(version3.id);
      expect(history[1].id).toBe(version2.id);
      expect(history[2].id).toBe(version1.id);
      
      expect(history[0].version).toBe('1.1.0');
      expect(history[1].version).toBe('1.0.1');
      expect(history[2].version).toBe('1.0.0');
    });

    it('should include user information in version history', async () => {
      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Version with user info',
      });

      const history = await VersionService.getVersionHistory(testPromptId);

      expect(history).toHaveLength(1);
      expect(history[0].createdByUser).toBeDefined();
      expect(history[0].createdByUser.id).toBe(testUserId);
      expect(history[0].createdByUser.name).toBe('Version Control Test User');
      expect(history[0].createdByUser.email).toBe('version-test@example.com');
    });
  });

  describe('Version Statistics', () => {
    it('should calculate correct version statistics', async () => {
      // Create versions of different types
      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Major version',
      });

      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MINOR,
        commitMessage: 'Minor version',
      });

      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.PATCH,
        commitMessage: 'Patch version 1',
      });

      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.PATCH,
        commitMessage: 'Patch version 2',
      });

      const stats = await VersionService.getVersionStats(testPromptId);

      expect(stats.totalVersions).toBe(4);
      expect(stats.versionsByType).toEqual({
        MAJOR: 1,
        MINOR: 1,
        PATCH: 2,
      });
      expect(stats.firstVersion).toBeDefined();
      expect(stats.lastVersion).toBeDefined();
      expect(new Date(stats.lastVersion).getTime()).toBeGreaterThan(new Date(stats.firstVersion).getTime());
    });

    it('should handle empty version history', async () => {
      const stats = await VersionService.getVersionStats(testPromptId);

      expect(stats.totalVersions).toBe(0);
      expect(stats.versionsByType).toEqual({});
    });
  });

  describe('Version Revert', () => {
    it('should revert prompt to specified version', async () => {
      // Create initial version
      const version1 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Original version',
      });

      // Update prompt content
      await prisma.prompt.update({
        where: { id: testPromptId },
        data: {
          content: 'Updated content for {{name}} on {{platform}} with {{feature}}',
          variables: [
            { name: 'name', type: 'text', description: 'User name' },
            { name: 'platform', type: 'text', description: 'Platform name' },
            { name: 'feature', type: 'text', description: 'New feature' },
          ],
        },
      });

      // Create second version
      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MINOR,
        commitMessage: 'Added new feature',
      });

      // Revert to first version
      const revertedPrompt = await VersionService.revertToVersion(testPromptId, version1.id);

      expect(revertedPrompt.content).toBe('Hello {{name}}, welcome to our {{platform}}!');
      expect(revertedPrompt.variables).toHaveLength(2);
      expect(revertedPrompt.variables[0].name).toBe('name');
      expect(revertedPrompt.variables[1].name).toBe('platform');

      // Verify the prompt in database was actually updated
      const promptFromDb = await prisma.prompt.findUnique({
        where: { id: testPromptId },
      });

      expect(promptFromDb?.content).toBe('Hello {{name}}, welcome to our {{platform}}!');
    });

    it('should throw error when reverting to non-existent version', async () => {
      await expect(
        VersionService.revertToVersion(testPromptId, 'non-existent-version-id')
      ).rejects.toThrow('Version not found');
    });
  });

  describe('Version Comparison', () => {
    it('should compare two versions correctly', async () => {
      // Create first version
      const version1 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Original version',
      });

      // Update prompt
      await prisma.prompt.update({
        where: { id: testPromptId },
        data: {
          content: 'Hello {{name}}, welcome to {{platform}} with {{newFeature}}!',
          variables: [
            { name: 'name', type: 'text', description: 'User name' },
            { name: 'platform', type: 'text', description: 'Platform name' },
            { name: 'newFeature', type: 'text', description: 'New feature description' },
          ],
        },
      });

      // Create second version
      const version2 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MINOR,
        commitMessage: 'Added new feature variable',
      });

      const comparison = await VersionService.compareVersions(version1.id, version2.id);

      expect(comparison.version1.id).toBe(version1.id);
      expect(comparison.version2.id).toBe(version2.id);
      expect(comparison.contentChanged).toBe(true);
      expect(comparison.variablesChanged).toBe(true);
      expect(comparison.summary.contentDiff).toContain('Content modified');
      expect(comparison.summary.variablesDiff).toContain('Variables modified');
    });

    it('should detect no changes between identical versions', async () => {
      const version1 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'First version',
      });

      const version2 = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.PATCH,
        commitMessage: 'Second version (no changes)',
      });

      const comparison = await VersionService.compareVersions(version1.id, version2.id);

      expect(comparison.contentChanged).toBe(false);
      expect(comparison.variablesChanged).toBe(false);
    });

    it('should throw error when comparing non-existent versions', async () => {
      await expect(
        VersionService.compareVersions('non-existent-1', 'non-existent-2')
      ).rejects.toThrow('One or both versions not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle prompts without previous versions', async () => {
      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.PATCH, // Should be treated as first version
        commitMessage: 'First version with patch type',
      });

      expect(version.version).toBe('1.0.0'); // Should start at 1.0.0 regardless of change type
    });

    it('should handle missing prompt gracefully', async () => {
      await expect(
        VersionService.createVersion({
          promptId: 'non-existent-prompt-id',
          userId: testUserId,
          changeType: VersionChangeType.MAJOR,
          commitMessage: 'Version for non-existent prompt',
        })
      ).rejects.toThrow('Prompt not found');
    });

    it('should handle empty commit messages', async () => {
      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: '', // Empty commit message
      });

      expect(version.commitMessage).toBe('');
      expect(version.version).toBe('1.0.0');
    });

    it('should handle undefined commit messages', async () => {
      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        // No commit message provided
      });

      expect(version.commitMessage).toBeNull();
      expect(version.version).toBe('1.0.0');
    });
  });

  describe('Database Integrity', () => {
    it('should maintain referential integrity between versions and prompts', async () => {
      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Version for integrity test',
      });

      // Verify version exists in database
      const versionFromDb = await prisma.promptVersion.findUnique({
        where: { id: version.id },
        include: {
          createdByUser: true,
        },
      });

      expect(versionFromDb).toBeDefined();
      expect(versionFromDb?.promptId).toBe(testPromptId);
      expect(versionFromDb?.createdById).toBe(testUserId);
      expect(versionFromDb?.createdByUser.email).toBe('version-test@example.com');
    });

    it('should handle concurrent version creation', async () => {
      // Simulate concurrent version creation
      const promises = [
        VersionService.createVersion({
          promptId: testPromptId,
          userId: testUserId,
          changeType: VersionChangeType.PATCH,
          commitMessage: 'Concurrent version 1',
        }),
        VersionService.createVersion({
          promptId: testPromptId,
          userId: testUserId,
          changeType: VersionChangeType.PATCH,
          commitMessage: 'Concurrent version 2',
        }),
        VersionService.createVersion({
          promptId: testPromptId,
          userId: testUserId,
          changeType: VersionChangeType.PATCH,
          commitMessage: 'Concurrent version 3',
        }),
      ];

      const versions = await Promise.all(promises);

      expect(versions).toHaveLength(3);
      
      // All versions should have unique IDs
      const ids = versions.map(v => v.id);
      expect(new Set(ids).size).toBe(3);
      
      // Versions should have sequential version numbers
      const versionNumbers = versions.map(v => v.version).sort();
      expect(versionNumbers).toEqual(['1.0.1', '1.0.2', '1.0.3']);
    });
  });
});