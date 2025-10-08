jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    prompt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    promptVersion: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { VersionChangeType, VersionService } from '../../services/versionService';

describe('VersionService behavior', () => {
  const serviceAny = VersionService as any;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('computes semantic increments across change types', async () => {
    (prisma.promptVersion.findFirst as jest.Mock).mockResolvedValueOnce(null);

    expect(await serviceAny.calculateNextVersion('prompt-1', VersionChangeType.PATCH)).toBe('1.0.0');

    (prisma.promptVersion.findFirst as jest.Mock).mockResolvedValueOnce({
      majorVersion: 1,
      minorVersion: 2,
      patchVersion: 3,
    });
    expect(await serviceAny.calculateNextVersion('prompt-1', VersionChangeType.PATCH)).toBe('1.2.4');

    (prisma.promptVersion.findFirst as jest.Mock).mockResolvedValueOnce({
      majorVersion: 1,
      minorVersion: 2,
      patchVersion: 3,
    });
    expect(await serviceAny.calculateNextVersion('prompt-1', VersionChangeType.MINOR)).toBe('1.3.0');

    (prisma.promptVersion.findFirst as jest.Mock).mockResolvedValueOnce({
      majorVersion: 1,
      minorVersion: 2,
      patchVersion: 3,
    });
    expect(await serviceAny.calculateNextVersion('prompt-1', VersionChangeType.MAJOR)).toBe('2.0.0');
  });

  it('calculates detailed change summary including folder moves', async () => {
    (prisma.folder.findUnique as jest.Mock)
      .mockResolvedValueOnce({ name: 'Old Folder' })
      .mockResolvedValueOnce({ name: 'New Folder' });

    const summary = await serviceAny.calculateChangesSummary(
      {
        name: 'New name',
        description: 'Updated description',
        content: 'Hello new world',
        variables: [
          { name: 'audience', type: 'text' },
          { name: 'tone', type: 'select', options: ['formal'] },
        ],
        folderId: 'new-folder',
      },
      {
        name: 'Old name',
        description: 'Old description',
        content: 'Hello world',
        variables: [{ name: 'audience', type: 'text' }],
        folderId: 'old-folder',
      }
    );

    expect(summary).not.toBeNull();
    expect(Object.keys(summary)).toEqual(
      expect.arrayContaining(['name', 'description', 'content', 'variables', 'folders'])
    );
    expect(summary.content.wordsAdded).toBeGreaterThanOrEqual(0);
    expect(summary.variables.added).toHaveLength(1);
    expect(summary.variables.description).toContain('Variables updated');
  });

  it('computes word differences for both additions and removals', () => {
    const diffAdded = serviceAny.calculateWordDiff('one two', 'one two three four');
    expect(diffAdded).toEqual({ added: 2, removed: 0 });

    const diffRemoved = serviceAny.calculateWordDiff('one two three', 'one');
    expect(diffRemoved).toEqual({ added: 0, removed: 2 });
  });

  it('identifies variable additions, removals, and modifications with readable description', () => {
    const changes = serviceAny.calculateVariableChanges(
      [
        { name: 'audience', type: 'text' },
        { name: 'tone', type: 'select', options: ['formal'] },
      ],
      [
        { name: 'audience', type: 'text', description: 'updated' },
        { name: 'region', type: 'text' },
      ]
    );

    expect(changes.added).toEqual([{ name: 'region', type: 'text' }]);
    expect(changes.removed).toEqual([{ name: 'tone', type: 'select', options: ['formal'] }]);
    expect(changes.modified[0].new.description).toBe('updated');

    const description = serviceAny.generateVariableChangeDescription(changes);
    expect(description).toContain('added');
    expect(description).toContain('removed');
    expect(description).toContain('modified');
  });

  it('summarizes folder membership changes and generates descriptions', () => {
    const folderChanges = serviceAny.calculateFolderChanges(
      [{ name: 'Marketing' }, { name: 'Sales' }],
      [{ name: 'Marketing' }, { name: 'Product' }]
    );

    expect(folderChanges.added).toEqual([{ name: 'Product' }]);
    expect(folderChanges.removed).toEqual([{ name: 'Sales' }]);

    const description = serviceAny.generateFolderChangeDescription(folderChanges);
    expect(description).toContain('Added to folders: Product');
    expect(description).toContain('Removed from folders: Sales');
  });

  it('describes folder id transitions across scenarios', async () => {
    (prisma.folder.findUnique as jest.Mock)
      .mockResolvedValueOnce({ name: 'Ideas' })
      .mockResolvedValueOnce({ name: 'Published' })
      .mockResolvedValueOnce({ name: 'Ideas' });

    const toFolder = await serviceAny.calculateFolderIdChanges(null, 'folder-1');
    expect(toFolder.description).toContain('All Prompts');

    const fromFolder = await serviceAny.calculateFolderIdChanges('folder-1', null);
    expect(fromFolder.description).toContain('All Prompts');

    const swapFolder = await serviceAny.calculateFolderIdChanges('folder-1', 'folder-2');
    expect(swapFolder.description).toContain('Moved from');
  });

  it('migrates existing versions and handles errors gracefully', async () => {
    const summarySpy = jest
      .spyOn(VersionService as any, 'calculateChangesSummary')
      .mockResolvedValueOnce({ summary: true })
      .mockRejectedValueOnce(new Error('diff failure'));

    (prisma.promptVersion.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'v1',
        versionNumber: '1.0.0',
        changesSummary: null,
        parentVersionId: 'p0',
        parentVersion: {},
      },
      {
        id: 'v2',
        versionNumber: '1.1.0',
        changesSummary: null,
        parentVersionId: 'p1',
        parentVersion: {},
      },
    ]);

    (prisma.promptVersion.update as jest.Mock).mockResolvedValue({});

    await VersionService.migrateExistingVersions();

    expect(summarySpy).toHaveBeenCalledTimes(2);
    expect(prisma.promptVersion.update).toHaveBeenCalledTimes(1);
  });

  it('computes version stats and enforces access control', async () => {
    (prisma.prompt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'prompt-1', userId: 'user-1' });

    await expect(VersionService.getVersionStats('prompt-1', 'user-1')).rejects.toThrow(
      'Prompt not found or access denied'
    );

    (prisma.promptVersion.aggregate as jest.Mock).mockResolvedValue({
      _count: { id: 3 },
      _min: { createdAt: new Date('2023-01-01') },
      _max: { createdAt: new Date('2023-01-10') },
    });
    (prisma.promptVersion.groupBy as jest.Mock).mockResolvedValue([
      { changeType: 'PATCH', _count: { changeType: 2 } },
      { changeType: 'MINOR', _count: { changeType: 1 } },
    ]);

    const stats = await VersionService.getVersionStats('prompt-1', 'user-1');

    expect(stats.totalVersions).toBe(3);
    expect(stats.versionsByType.PATCH).toBe(2);
  });
});
