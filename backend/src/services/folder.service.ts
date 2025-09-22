import prisma from '../lib/prisma';
import type { Folder } from '@prisma/client';

export interface CreateFolderData {
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
}

export interface UpdateFolderData {
  name?: string;
  description?: string;
  color?: string;
  parentId?: string;
}

export interface FolderWithChildren extends Folder {
  children: FolderWithChildren[];
  _count: {
    prompts: number;
    children: number;
  };
}

export class FolderService {
  /**
   * Create a new folder
   */
  static async createFolder(userId: string, data: CreateFolderData): Promise<Folder> {
    // Validate parent folder exists and belongs to user if parentId is provided
    if (data.parentId) {
      const parentFolder = await prisma.folder.findFirst({
        where: {
          id: data.parentId,
          userId
        }
      });

      if (!parentFolder) {
        throw new Error('Parent folder not found or access denied');
      }
    }

    // Check for duplicate folder names within the same parent
    const existingFolder = await prisma.folder.findFirst({
      where: {
        userId,
        name: data.name,
        parentId: data.parentId || null
      }
    });

    if (existingFolder) {
      throw new Error('A folder with this name already exists in this location');
    }

    return await prisma.folder.create({
      data: {
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        parentId: data.parentId || null,
        userId
      }
    });
  }

  /**
   * Get all folders for a user in a hierarchical structure
   */
  static async getUserFolders(userId: string): Promise<FolderWithChildren[]> {
    const folders = await prisma.folder.findMany({
      where: {
        userId
      },
      include: {
        _count: {
          select: {
            prompts: true,
            children: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Build hierarchical structure
    return this.buildFolderHierarchy(folders);
  }

  /**
   * Get a specific folder with its contents
   */
  static async getFolder(userId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId
      },
      include: {
        prompts: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            _count: {
              select: {
                executions: true
              }
            }
          },
          orderBy: {
            updatedAt: 'desc'
          }
        },
        children: {
          include: {
            _count: {
              select: {
                prompts: true,
                children: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        },
        parent: true,
        _count: {
          select: {
            prompts: true,
            children: true
          }
        }
      }
    });

    if (!folder) {
      throw new Error('Folder not found or access denied');
    }

    return folder;
  }

  /**
   * Update a folder
   */
  static async updateFolder(userId: string, folderId: string, data: UpdateFolderData): Promise<Folder> {
    // Check if folder exists and belongs to user
    const existingFolder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId
      }
    });

    if (!existingFolder) {
      throw new Error('Folder not found or access denied');
    }

    // Validate parent folder if parentId is being updated
    if (data.parentId !== undefined) {
      if (data.parentId) {
        // Prevent circular references
        if (data.parentId === folderId) {
          throw new Error('A folder cannot be its own parent');
        }

        // Check if the new parent exists and belongs to user
        const parentFolder = await prisma.folder.findFirst({
          where: {
            id: data.parentId,
            userId
          }
        });

        if (!parentFolder) {
          throw new Error('Parent folder not found or access denied');
        }

        // Check for circular reference in hierarchy
        const isCircular = await this.wouldCreateCircularReference(folderId, data.parentId);
        if (isCircular) {
          throw new Error('Moving folder would create a circular reference');
        }
      }
    }

    // Check for duplicate names if name is being updated
    if (data.name && data.name !== existingFolder.name) {
      const duplicateFolder = await prisma.folder.findFirst({
        where: {
          userId,
          name: data.name,
          parentId: data.parentId !== undefined ? data.parentId : existingFolder.parentId,
          id: {
            not: folderId
          }
        }
      });

      if (duplicateFolder) {
        throw new Error('A folder with this name already exists in this location');
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.color !== undefined) updateData.color = data.color || null;
    if (data.parentId !== undefined) updateData.parentId = data.parentId || null;

    return await prisma.folder.update({
      where: {
        id: folderId
      },
      data: updateData
    });
  }

  /**
   * Delete a folder and optionally move its contents
   */
  static async deleteFolder(userId: string, folderId: string, moveToFolderId?: string): Promise<void> {
    // Check if folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId
      },
      include: {
        prompts: true,
        children: true
      }
    });

    if (!folder) {
      throw new Error('Folder not found or access denied');
    }

    // If moveToFolderId is provided, validate it
    if (moveToFolderId) {
      const targetFolder = await prisma.folder.findFirst({
        where: {
          id: moveToFolderId,
          userId
        }
      });

      if (!targetFolder) {
        throw new Error('Target folder not found or access denied');
      }
    }

    // Move contents to target folder or root
    await prisma.$transaction(async (tx: any) => {
      // Move prompts
      if (folder.prompts.length > 0) {
        await tx.prompt.updateMany({
          where: {
            folderId: folderId
          },
          data: {
            folderId: moveToFolderId || null
          }
        });
      }

      // Move child folders
      if (folder.children.length > 0) {
        await tx.folder.updateMany({
          where: {
            parentId: folderId
          },
          data: {
            parentId: moveToFolderId || null
          }
        });
      }

      // Delete the folder
      await tx.folder.delete({
        where: {
          id: folderId
        }
      });
    });
  }

  /**
   * Build hierarchical folder structure
   */
  private static buildFolderHierarchy(folders: Array<Folder & { _count: { prompts: number; children: number } }>): FolderWithChildren[] {
    const folderMap = new Map<string, FolderWithChildren>();
    const rootFolders: FolderWithChildren[] = [];

    // Create folder objects with children arrays
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: []
      });
    });

    // Build hierarchy
    folders.forEach(folder => {
      const folderWithChildren = folderMap.get(folder.id)!;
      
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(folderWithChildren);
        } else {
          // Parent not found, treat as root folder
          rootFolders.push(folderWithChildren);
        }
      } else {
        rootFolders.push(folderWithChildren);
      }
    });

    return rootFolders;
  }

  /**
   * Check if moving a folder would create a circular reference
   */
  private static async wouldCreateCircularReference(folderId: string, newParentId: string): Promise<boolean> {
    let currentParentId: string | null = newParentId;
    
    while (currentParentId) {
      if (currentParentId === folderId) {
        return true;
      }
      
      const parent: { parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: currentParentId },
        select: { parentId: true }
      });
      
      currentParentId = parent?.parentId || null;
    }
    
    return false;
  }
}
