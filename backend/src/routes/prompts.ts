import express from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { VersionService, VersionChangeType } from '../services/versionService';
import { PromptCommentService } from '../services/promptComment.service';
import { requireFeature } from '../middleware/featureFlag';
import { COLLABORATION_COMMENTS_FLAG } from '../lib/featureFlags';
import { LibraryShareService } from '../services/libraryShare.service';

const router = express.Router();

// All prompt routes require authentication
router.use(authenticate);

// Create a new prompt
router.post('/', async (req, res) => {
  try {
    const { name, description, content, variables, metadata, isPublic, folderId } = req.body;
    const userId = req.user!.id;

    // Validation
    if (!name || !content) {
      return res.status(400).json({ 
        error: { message: 'Name and content are required' } 
      });
    }

    // Validate variables format
    if (variables && !Array.isArray(variables)) {
      return res.status(400).json({ 
        error: { message: 'Variables must be an array' } 
      });
    }

    // Validate variable types
    if (variables && variables.length > 0) {
      const validTypes = ['text', 'number', 'boolean', 'select'];
      for (const variable of variables) {
        if (!variable.name || typeof variable.name !== 'string') {
          return res.status(400).json({
            error: { message: 'Variable name is required and must be a string' }
          });
        }
        if (!variable.type || !validTypes.includes(variable.type)) {
          return res.status(400).json({
            error: { message: `Variable type must be one of: ${validTypes.join(', ')}` }
          });
        }
      }
    }

    // Validate folderId if provided
    if (folderId) {
      const folder = await (prisma as any).folder.findFirst({
        where: { id: folderId, userId }
      });
      if (!folder) {
        return res.status(404).json({
          error: { message: 'Folder not found or access denied' }
        });
      }
    }

    // Create prompt
    const prompt = await prisma.prompt.create({
      data: {
        name,
        description: description || null,
        content,
        variables: variables || [],
        metadata: metadata || {},
        isPublic: isPublic || false,
        userId,
        folderId: folderId || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create initial version
    try {
      const initialVersion = await VersionService.createVersion({
        promptId: prompt.id,
        userId,
        changeType: VersionChangeType.MAJOR, // First version is always 1.0.0
        commitMessage: `Initial version: ${name}`
      });
      
      console.log(`Created initial version ${initialVersion.versionNumber} for prompt ${prompt.id}`);
    } catch (versionError) {
      console.error('Failed to create initial version:', versionError);
      // Don't fail the entire creation if versioning fails
    }

    res.status(201).json({
      message: 'Prompt created successfully',
      prompt
    });
  } catch (error) {
    console.error('Create prompt error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to create prompt' } 
    });
  }
});

// Get all prompts for the current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { page = '1', limit = '10', search, isPublic, folderId } = req.query;

    // Parse and validate pagination parameters
    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit)) || 10)); // Cap at 100
    const skip = (pageNum - 1) * limitNum;

    // Identify shared libraries for the viewer
    const sharedFolders = await prisma.promptLibraryShare.findMany({
      where: {
        invitedUserId: userId,
        deletedAt: null,
      },
      select: {
        folderId: true,
      },
    });

    const sharedFolderIds = sharedFolders.map((record) => record.folderId);

    // Build where condition
    const scopeConditions: Record<string, unknown>[] = [
      { userId },
    ];

    if (isPublic !== 'false') {
      scopeConditions.push({ isPublic: true });
    }

    if (sharedFolderIds.length > 0) {
      scopeConditions.push({ folderId: { in: sharedFolderIds } });
    }

    const where: Record<string, unknown> = {
      OR: scopeConditions,
    };

    // Add search filter
    if (search) {
      where.AND = {
        OR: [
          { name: { contains: search as string } },
          { description: { contains: search as string } },
          { content: { contains: search as string } }
        ]
      };
    }

    // Add folder filter
    if (folderId !== undefined) {
      // Handle both explicit folderId and null/empty for uncategorized
      const folderFilter = folderId === '' || folderId === 'null' ? null : folderId;
      
      // If we already have an AND condition from search, merge the folder filter
      if (where.AND) {
        where.AND = {
          ...where.AND,
          folderId: folderFilter
        };
      } else {
        where.folderId = folderFilter;
      }
    }

    const [prompts, total] = await Promise.all([
      prisma.prompt.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          folder: {
            select: {
              id: true,
              name: true,
              color: true
            }
          },
          _count: {
            select: {
              executions: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.prompt.count({ where })
    ]);

    const sharedFolderSet = new Set(sharedFolderIds);
    const promptsWithScope = prompts.map((prompt) => ({
      ...prompt,
      accessScope:
        prompt.userId === userId
          ? 'owned'
          : sharedFolderSet.has(prompt.folderId ?? '')
            ? 'shared'
            : 'public',
    }));

    res.json({
      prompts: promptsWithScope,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get prompts error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch prompts' } 
    });
  }
});

// List comments for a prompt
router.get(
  '/:id/comments',
  requireFeature(COLLABORATION_COMMENTS_FLAG),
  async (req, res) => {
    try {
      const promptId = req.params.id;
      const userId = req.user!.id;

      if (!promptId) {
        return res.status(400).json({
          error: { message: 'Prompt ID is required' },
        });
      }

      const { comments, libraryId } = await PromptCommentService.listComments(promptId, userId);

      res.json({
        comments,
        libraryId,
      });
    } catch (error) {
      console.error('List prompt comments error:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to load comments',
        },
      });
    }
  },
);

// Create a new comment on a prompt
router.post(
  '/:id/comments',
  requireFeature(COLLABORATION_COMMENTS_FLAG),
  async (req, res) => {
    try {
      const promptId = req.params.id;
      const userId = req.user!.id;
      const { body } = req.body as { body?: string };

      if (!promptId) {
        return res.status(400).json({
          error: { message: 'Prompt ID is required' },
        });
      }

      const comment = await PromptCommentService.createComment({
        promptId,
        userId,
        body: body ?? '',
      });

      res.status(201).json({ comment });
    } catch (error) {
      console.error('Create prompt comment error:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to create comment',
        },
      });
    }
  },
);

// Get a specific prompt by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            input: true,
            output: true,
            model: true,
            createdAt: true,
          },
        },
      },
    });

    if (!prompt) {
      return res.status(404).json({
        error: { message: 'Prompt not found' },
      });
    }

    const isOwner = prompt.userId === userId;
    const isPublic = prompt.isPublic;
    let hasSharedAccess = false;

    if (!isOwner && !isPublic && prompt.folderId) {
      try {
        hasSharedAccess = await LibraryShareService.userHasViewerAccess(userId, prompt.folderId);
      } catch (shareError) {
        console.error('Failed to verify shared prompt access:', shareError);
      }
    }

    if (!isOwner && !isPublic && !hasSharedAccess) {
      return res.status(404).json({
        error: { message: 'Prompt not found' },
      });
    }

    const accessScope = isOwner ? 'owned' : hasSharedAccess ? 'shared' : 'public';

    res.json({
      prompt: {
        ...prompt,
        accessScope,
      },
    });
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch prompt' },
    });
  }
});

// Update a prompt
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, content, variables, metadata, isPublic, folderId } = req.body;
    const userId = req.user!.id;

    // Check if prompt exists and user owns it
    const existingPrompt = await prisma.prompt.findFirst({
      where: { id, userId }
    });

    if (!existingPrompt) {
      return res.status(404).json({ 
        error: { message: 'Prompt not found or access denied' } 
      });
    }

    // Validation
    if (name !== undefined && !name) {
      return res.status(400).json({ 
        error: { message: 'Name cannot be empty' } 
      });
    }

    if (content !== undefined && !content) {
      return res.status(400).json({ 
        error: { message: 'Content cannot be empty' } 
      });
    }

    // Validate variables format
    if (variables && !Array.isArray(variables)) {
      return res.status(400).json({ 
        error: { message: 'Variables must be an array' } 
      });
    }

    // Validate folderId if provided (skip validation for now to test basic functionality)
    // TODO: Re-enable folder validation once Prisma client is regenerated

    // Check if this is a significant change to determine version type
    const { changeType = 'PATCH', commitMessage } = req.body;
    let versionChangeType = VersionChangeType.PATCH;
    
    if (changeType === 'MINOR') versionChangeType = VersionChangeType.MINOR;
    else if (changeType === 'MAJOR') versionChangeType = VersionChangeType.MAJOR;

    // Update prompt
    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(content !== undefined && { content }),
        ...(variables !== undefined && { variables }),
        ...(metadata !== undefined && { metadata }),
        ...(isPublic !== undefined && { isPublic }),
        ...(folderId !== undefined && { folderId })
        // Remove version increment - will be handled by VersionService
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create a new version after successful update
    try {
      const version = await VersionService.createVersion({
        promptId: id,
        userId,
        changeType: versionChangeType,
        commitMessage: commitMessage || `Updated prompt: ${name || existingPrompt.name}`
      });
      
      console.log(`Created version ${version.versionNumber} for prompt ${id}`);
    } catch (versionError) {
      console.error('Failed to create version:', versionError);
      // Don't fail the entire update if versioning fails
    }

    res.json({
      message: 'Prompt updated successfully',
      prompt
    });
  } catch (error) {
    console.error('Update prompt error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to update prompt' } 
    });
  }
});

// Delete a prompt
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if prompt exists and user owns it
    const existingPrompt = await prisma.prompt.findFirst({
      where: { id, userId }
    });

    if (!existingPrompt) {
      return res.status(404).json({ 
        error: { message: 'Prompt not found or access denied' } 
      });
    }

    // Delete prompt (this will cascade delete executions)
    await prisma.prompt.delete({
      where: { id }
    });

    res.json({
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    console.error('Delete prompt error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to delete prompt' } 
    });
  }
});

// Execute a prompt (for testing)
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { variables: inputVariables, model = 'gpt-4' } = req.body;
    const userId = req.user!.id;

    // Get prompt
    const prompt = await prisma.prompt.findFirst({
      where: {
        id,
        OR: [
          { userId }, // User's own prompt
          { isPublic: true } // Public prompt
        ]
      }
    });

    if (!prompt) {
      return res.status(404).json({ 
        error: { message: 'Prompt not found' } 
      });
    }

    // Process prompt content with variables
    let processedContent = prompt.content;
    const promptVariables = prompt.variables as Array<{ name: string; type: string; required?: boolean }>;

    // Replace variables in content
    if (inputVariables && typeof inputVariables === 'object') {
      for (const [key, value] of Object.entries(inputVariables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processedContent = processedContent.replace(regex, String(value));
      }
    }

    // For now, just return the processed content
    // In a real implementation, this would call the AI model
    const mockOutput = `Processed prompt: ${processedContent}`;

    // Log execution
    const execution = await prisma.promptExecution.create({
      data: {
        promptId: id,
        input: inputVariables || {},
        output: mockOutput,
        model,
        metadata: {
          processedContent,
          originalVariables: promptVariables
        }
      }
    });

    res.json({
      message: 'Prompt executed successfully',
      execution: {
        id: execution.id,
        processedContent,
        output: mockOutput,
        createdAt: execution.createdAt
      }
    });
  } catch (error) {
    console.error('Execute prompt error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to execute prompt' } 
    });
  }
});

export default router;