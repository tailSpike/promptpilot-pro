import { FolderService } from '../../services/folder.service';
import prisma from '../../lib/prisma';

describe('FolderService', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: 'folder-test@example.com',
        name: 'Folder Test User',
        password: 'hashedpassword'
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.folder.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });
  });

  afterEach(async () => {
    // Clean up folders after each test
    await prisma.folder.deleteMany({
      where: { userId: testUserId }
    });
  });

  describe('createFolder', () => {
    it('should create a root folder successfully', async () => {
      const folderData = {
        name: 'Test Folder',
        description: 'A test folder',
        color: '#3B82F6'
      };

      const folder = await FolderService.createFolder(testUserId, folderData);

      expect(folder).toBeDefined();
      expect(folder.name).toBe('Test Folder');
      expect(folder.description).toBe('A test folder');
      expect(folder.color).toBe('#3B82F6');
      expect(folder.parentId).toBeNull();
      expect(folder.userId).toBe(testUserId);
    });

    it('should create a child folder successfully', async () => {
      // Create parent folder first
      const parentFolder = await FolderService.createFolder(testUserId, {
        name: 'Parent Folder'
      });

      const childFolderData = {
        name: 'Child Folder',
        parentId: parentFolder.id
      };

      const childFolder = await FolderService.createFolder(testUserId, childFolderData);

      expect(childFolder).toBeDefined();
      expect(childFolder.name).toBe('Child Folder');
      expect(childFolder.parentId).toBe(parentFolder.id);
    });

    it('should prevent duplicate folder names in the same parent', async () => {
      await FolderService.createFolder(testUserId, {
        name: 'Duplicate Test'
      });

      await expect(
        FolderService.createFolder(testUserId, {
          name: 'Duplicate Test'
        })
      ).rejects.toThrow('A folder with this name already exists in this location');
    });

    it('should allow same folder names in different parents', async () => {
      const parent1 = await FolderService.createFolder(testUserId, {
        name: 'Parent 1'
      });

      const parent2 = await FolderService.createFolder(testUserId, {
        name: 'Parent 2'
      });

      const child1 = await FolderService.createFolder(testUserId, {
        name: 'Same Name',
        parentId: parent1.id
      });

      const child2 = await FolderService.createFolder(testUserId, {
        name: 'Same Name',
        parentId: parent2.id
      });

      expect(child1.name).toBe('Same Name');
      expect(child2.name).toBe('Same Name');
      expect(child1.parentId).toBe(parent1.id);
      expect(child2.parentId).toBe(parent2.id);
    });

    it('should reject non-existent parent folder', async () => {
      await expect(
        FolderService.createFolder(testUserId, {
          name: 'Test Folder',
          parentId: 'non-existent-id'
        })
      ).rejects.toThrow('Parent folder not found or access denied');
    });
  });

  describe('getUserFolders', () => {
    it('should return empty array for user with no folders', async () => {
      const folders = await FolderService.getUserFolders(testUserId);
      expect(folders).toEqual([]);
    });

    it('should return hierarchical folder structure', async () => {
      // Create folder hierarchy
      const root1 = await FolderService.createFolder(testUserId, {
        name: 'Root 1'
      });

      const _root2 = await FolderService.createFolder(testUserId, {
        name: 'Root 2'
      });

      const child1 = await FolderService.createFolder(testUserId, {
        name: 'Child 1',
        parentId: root1.id
      });

      const _grandchild = await FolderService.createFolder(testUserId, {
        name: 'Grandchild',
        parentId: child1.id
      });

      const folders = await FolderService.getUserFolders(testUserId);

      expect(folders).toHaveLength(2); // Two root folders
      
      const root1Result = folders.find(f => f.name === 'Root 1');
      const root2Result = folders.find(f => f.name === 'Root 2');

      expect(root1Result).toBeDefined();
      expect(root1Result!.children).toHaveLength(1);
      const child1Folder = root1Result!.children![0] as any;
      expect(child1Folder?.name).toBe('Child 1');
      expect(child1Folder?.children).toHaveLength(1);
      const grandchildFolder = child1Folder?.children?.[0] as any;
      expect(grandchildFolder?.name).toBe('Grandchild');

      expect(root2Result).toBeDefined();
      expect(root2Result!.children).toHaveLength(0);
    });
  });

  describe('updateFolder', () => {
    it('should update folder properties successfully', async () => {
      const folder = await FolderService.createFolder(testUserId, {
        name: 'Original Name',
        description: 'Original description',
        color: '#3B82F6'
      });

      const updatedFolder = await FolderService.updateFolder(testUserId, folder.id, {
        name: 'Updated Name',
        description: 'Updated description',
        color: '#EF4444'
      });

      expect(updatedFolder.name).toBe('Updated Name');
      expect(updatedFolder.description).toBe('Updated description');
      expect(updatedFolder.color).toBe('#EF4444');
    });

    it('should prevent circular references when moving folders', async () => {
      const parent = await FolderService.createFolder(testUserId, {
        name: 'Parent'
      });

      const child = await FolderService.createFolder(testUserId, {
        name: 'Child',
        parentId: parent.id
      });

      const grandchild = await FolderService.createFolder(testUserId, {
        name: 'Grandchild',
        parentId: child.id
      });

      // Try to make parent a child of grandchild (circular reference)
      await expect(
        FolderService.updateFolder(testUserId, parent.id, {
          parentId: grandchild.id
        })
      ).rejects.toThrow('Moving folder would create a circular reference');
    });

    it('should prevent folder from being its own parent', async () => {
      const folder = await FolderService.createFolder(testUserId, {
        name: 'Test Folder'
      });

      await expect(
        FolderService.updateFolder(testUserId, folder.id, {
          parentId: folder.id
        })
      ).rejects.toThrow('A folder cannot be its own parent');
    });
  });

  describe('deleteFolder', () => {
    it('should delete empty folder successfully', async () => {
      const folder = await FolderService.createFolder(testUserId, {
        name: 'To Delete'
      });

      await FolderService.deleteFolder(testUserId, folder.id);

      const folders = await FolderService.getUserFolders(testUserId);
      expect(folders).toHaveLength(0);
    });

    it('should move contents to root when deleting folder', async () => {
      // Create folder with prompt and child folder
      const folder = await FolderService.createFolder(testUserId, {
        name: 'To Delete'
      });

      const _childFolder = await FolderService.createFolder(testUserId, {
        name: 'Child',
        parentId: folder.id
      });

      // Create a prompt in the folder
      const prompt = await prisma.prompt.create({
        data: {
          name: 'Test Prompt',
          content: 'Test content',
          variables: [],
          userId: testUserId,
          folderId: folder.id
        }
      });

      await FolderService.deleteFolder(testUserId, folder.id);

      // Check that child folder moved to root
      const folders = await FolderService.getUserFolders(testUserId);
      expect(folders).toHaveLength(1);
      const firstFolder = folders[0] as any;
      expect(firstFolder?.name).toBe('Child');
      expect(firstFolder?.parentId).toBeNull();

      // Check that prompt moved to root
      const updatedPrompt = await prisma.prompt.findUnique({
        where: { id: prompt.id }
      });
      expect(updatedPrompt!.folderId).toBeNull();
    });

    it('should move contents to specified folder when deleting', async () => {
      const targetFolder = await FolderService.createFolder(testUserId, {
        name: 'Target'
      });

      const folderToDelete = await FolderService.createFolder(testUserId, {
        name: 'To Delete'
      });

      const _childFolder = await FolderService.createFolder(testUserId, {
        name: 'Child',
        parentId: folderToDelete.id
      });

      await FolderService.deleteFolder(testUserId, folderToDelete.id, targetFolder.id);

      const folders = await FolderService.getUserFolders(testUserId);
      const target = folders.find(f => (f as any).name === 'Target');
      
      expect(target).toBeDefined();
      expect(target!.children).toHaveLength(1);
      const targetChild = target!.children![0] as any;
      expect(targetChild?.name).toBe('Child');
    });
  });
});