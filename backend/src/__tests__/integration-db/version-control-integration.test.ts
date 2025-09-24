/**
 * Integration tests for Version Control System with main database
 * These tests validate the complete end-to-end version control workflow
 */

import prisma from '../../lib/prisma';
import { VersionService, VersionChangeType } from '../../services/versionService';

describe('Version Control Integration Tests (Real Database)', () => {
  let testUserId: string;
  let testPromptId: string;

  beforeAll(async () => {
    // Create test user with unique email to avoid conflicts
    const testUser = await prisma.user.create({
      data: {
        name: 'Version Control Test User',
        email: `version-test-${Date.now()}@example.com`,
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
        userId: testUserId,
      },
    });
    testPromptId = testPrompt.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.promptVersion.deleteMany({
      where: { promptId: testPromptId },
    });
    await prisma.prompt.delete({
      where: { id: testPromptId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
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
      expect(version.versionNumber).toBe('1.0.0');
      expect(version.majorVersion).toBe(1);
      expect(version.minorVersion).toBe(0);
      expect(version.patchVersion).toBe(0);
      expect(version.commitMessage).toBe('Initial version of the greeting prompt');
      expect(version.changeType).toBe('MAJOR');
      expect(version.promptId).toBe(testPromptId);
      expect(version.createdBy).toBe(testUserId);
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

      expect(patchVersion.versionNumber).toBe('1.0.1');

      // Create minor version
      const minorVersion = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MINOR,
        commitMessage: 'New feature',
      });

      expect(minorVersion.versionNumber).toBe('1.1.0');

      // Create major version
      const majorVersion = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Breaking change',
      });

      expect(majorVersion.versionNumber).toBe('2.0.0');
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
      expect(version.folderId).toBe(prompt?.folderId);
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

      const history = await VersionService.getVersionHistory(testPromptId, testUserId);

      expect(history).toHaveLength(3);
      
      // Should be ordered by creation date descending (newest first)
      expect(history[0].id).toBe(version3.id);
      expect(history[1].id).toBe(version2.id);
      expect(history[2].id).toBe(version1.id);
      
      expect(history[0].versionNumber).toBe('1.1.0');
      expect(history[1].versionNumber).toBe('1.0.1');
      expect(history[2].versionNumber).toBe('1.0.0');
    });

    it('should include user information in version history', async () => {
      await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        commitMessage: 'Version with user info',
      });

      const history = await VersionService.getVersionHistory(testPromptId, testUserId);

      expect(history).toHaveLength(1);
      expect(history[0].createdByUser).toBeDefined();
      expect(history[0].createdByUser.id).toBe(testUserId);
      expect(history[0].createdByUser.name).toBe('Version Control Test User');
      expect(history[0].createdByUser.email).toContain('version-test-');
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

      const stats = await VersionService.getVersionStats(testPromptId, testUserId);

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
      const stats = await VersionService.getVersionStats(testPromptId, testUserId);

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
      const revertedPrompt = await VersionService.revertToVersion(testPromptId, version1.id, testUserId);

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
        VersionService.revertToVersion(testPromptId, 'non-existent-version-id', testUserId)
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

      const comparison = await VersionService.compareVersions(version1.id, version2.id, testUserId);

      expect(comparison).toBeInstanceOf(Array);
      expect(comparison.length).toBeGreaterThan(0);
      
      // Check that there are content and variable changes
      const contentDiff = comparison.find(diff => diff.field === 'content');
      const variablesDiff = comparison.find(diff => diff.field === 'variables');
      
      expect(contentDiff).toBeDefined();
      expect(variablesDiff).toBeDefined();
      expect(contentDiff?.changeType).toBe('modified');
      expect(variablesDiff?.changeType).toBe('modified');
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

      const comparison = await VersionService.compareVersions(version1.id, version2.id, testUserId);

      expect(comparison).toBeInstanceOf(Array);
      expect(comparison.length).toBe(0); // No changes should result in empty array
    });

    it('should throw error when comparing non-existent versions', async () => {
      await expect(
        VersionService.compareVersions('non-existent-1', 'non-existent-2', testUserId)
      ).rejects.toThrow('Version not found or access denied');
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

      expect(version.versionNumber).toBe('1.0.0'); // Should start at 1.0.0 regardless of change type
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
      expect(version.versionNumber).toBe('1.0.0');
    });

    it('should handle undefined commit messages', async () => {
      const version = await VersionService.createVersion({
        promptId: testPromptId,
        userId: testUserId,
        changeType: VersionChangeType.MAJOR,
        // No commit message provided
      });

      expect(version.commitMessage).toBeNull();
      expect(version.versionNumber).toBe('1.0.0');
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
      expect(versionFromDb?.createdBy).toBe(testUserId);
      expect(versionFromDb?.createdByUser.email).toContain('version-test-');
    });

    it('should handle concurrent version creation', async () => {
      // Test concurrent version creation - expect it to fail gracefully
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

      // Some promises might fail due to unique constraint violations
      const results = await Promise.allSettled(promises);
      
      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);
      
      // Some might fail with unique constraint error
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        const error = (failed[0] as PromiseRejectedResult).reason;
        expect(error.message).toContain('Unique constraint failed');
      }
    });
  });
});