import express from 'express';
import { authenticate } from '../middleware/auth';
import { FolderService } from '../services/folder.service';
import type { CreateFolderData, UpdateFolderData } from '../services/folder.service';
import prisma from '../lib/prisma';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Create a new folder
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, description, color, parentId } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: { message: 'Folder name is required and must be a non-empty string' }
      });
    }

    // Validate name length
    if (name.trim().length > 100) {
      return res.status(400).json({
        error: { message: 'Folder name must be 100 characters or less' }
      });
    }

    // Validate description length if provided
    if (description && typeof description === 'string' && description.length > 500) {
      return res.status(400).json({
        error: { message: 'Folder description must be 500 characters or less' }
      });
    }

    // Validate color format if provided (hex color)
    if (color && typeof color === 'string' && !/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({
        error: { message: 'Color must be a valid hex color code (e.g., #FF5733)' }
      });
    }

    // Validate parentId if provided
    if (parentId && typeof parentId !== 'string') {
      return res.status(400).json({
        error: { message: 'Parent folder ID must be a string' }
      });
    }

    const folderData: CreateFolderData = {
      name: name.trim(),
      description: description?.trim() || undefined,
      color: color || undefined,
      parentId: parentId || undefined
    };

    const folder = await FolderService.createFolder(userId, folderData);

    res.status(201).json({
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    console.error('Create folder error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: { message: error.message }
        });
      }
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: { message: error.message }
        });
      }
    }

    res.status(500).json({
      error: { message: 'Failed to create folder' }
    });
  }
});

// Get all folders for the current user (hierarchical structure)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const folders = await FolderService.getUserFolders(userId);

    // Get prompt counts for special views
    const totalPrompts = await prisma.prompt.count({
      where: { userId }
    });
    
    const uncategorizedPrompts = await prisma.prompt.count({
      where: { 
        userId,
        folderId: null 
      }
    });

    res.json({
      message: 'Folders retrieved successfully',
      folders,
      counts: {
        total: totalPrompts,
        uncategorized: uncategorizedPrompts
      }
    });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      error: { message: 'Failed to retrieve folders' }
    });
  }
});

// Get a specific folder with its contents
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: { message: 'Folder ID is required' }
      });
    }

    const folder = await FolderService.getFolder(userId, id);

    res.json({
      message: 'Folder retrieved successfully',
      folder
    });
  } catch (error) {
    console.error('Get folder error:', error);
    
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('access denied'))) {
      return res.status(404).json({
        error: { message: error.message }
      });
    }

    res.status(500).json({
      error: { message: 'Failed to retrieve folder' }
    });
  }
});

// Update a folder
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, color, parentId } = req.body;

    if (!id) {
      return res.status(400).json({
        error: { message: 'Folder ID is required' }
      });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: { message: 'Folder name must be a non-empty string' }
        });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({
          error: { message: 'Folder name must be 100 characters or less' }
        });
      }
    }

    // Validate description if provided
    if (description !== undefined && description !== null && typeof description === 'string' && description.length > 500) {
      return res.status(400).json({
        error: { message: 'Folder description must be 500 characters or less' }
      });
    }

    // Validate color format if provided
    if (color !== undefined && color !== null && typeof color === 'string' && !/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({
        error: { message: 'Color must be a valid hex color code (e.g., #FF5733)' }
      });
    }

    // Validate parentId if provided
    if (parentId !== undefined && parentId !== null && typeof parentId !== 'string') {
      return res.status(400).json({
        error: { message: 'Parent folder ID must be a string' }
      });
    }

    const updateData: UpdateFolderData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (color !== undefined) updateData.color = color || null;
    if (parentId !== undefined) updateData.parentId = parentId || null;

    const folder = await FolderService.updateFolder(userId, id, updateData);

    res.json({
      message: 'Folder updated successfully',
      folder
    });
  } catch (error) {
    console.error('Update folder error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: { message: error.message }
        });
      }
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: { message: error.message }
        });
      }
      if (error.message.includes('circular reference') || error.message.includes('own parent')) {
        return res.status(400).json({
          error: { message: error.message }
        });
      }
    }

    res.status(500).json({
      error: { message: 'Failed to update folder' }
    });
  }
});

// Delete a folder
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { moveToFolderId } = req.query;

    if (!id) {
      return res.status(400).json({
        error: { message: 'Folder ID is required' }
      });
    }

    // Validate moveToFolderId if provided
    if (moveToFolderId && typeof moveToFolderId !== 'string') {
      return res.status(400).json({
        error: { message: 'Move to folder ID must be a string' }
      });
    }

    await FolderService.deleteFolder(userId, id, moveToFolderId as string | undefined);

    res.json({
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('Delete folder error:', error);
    
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('access denied'))) {
      return res.status(404).json({
        error: { message: error.message }
      });
    }

    res.status(500).json({
      error: { message: 'Failed to delete folder' }
    });
  }
});

export default router;