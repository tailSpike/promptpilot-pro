import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All prompt routes require authentication
router.use(authenticate);

// Create a new prompt
router.post('/', async (req, res) => {
  try {
    const { name, description, content, variables, metadata, isPublic } = req.body;
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

    // Create prompt
    const prompt = await prisma.prompt.create({
      data: {
        name,
        description: description || null,
        content,
        variables: variables || [],
        metadata: metadata || {},
        isPublic: isPublic || false,
        userId
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
    const { page = '1', limit = '10', search, isPublic } = req.query;

    // Parse and validate pagination parameters
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 10)); // Cap at 100
    const skip = (pageNum - 1) * limitNum;

    // Build where condition
    const where: any = {
      OR: [
        { userId }, // User's own prompts
        ...(isPublic !== 'false' ? [{ isPublic: true }] : []) // Public prompts (unless explicitly excluded)
      ]
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

    res.json({
      prompts,
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

// Get a specific prompt by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const prompt = await prisma.prompt.findFirst({
      where: {
        id,
        OR: [
          { userId }, // User's own prompt
          { isPublic: true } // Public prompt
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            input: true,
            output: true,
            model: true,
            createdAt: true
          }
        }
      }
    });

    if (!prompt) {
      return res.status(404).json({ 
        error: { message: 'Prompt not found' } 
      });
    }

    res.json({ prompt });
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch prompt' } 
    });
  }
});

// Update a prompt
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, content, variables, metadata, isPublic } = req.body;
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
        version: existingPrompt.version + 1
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
    const promptVariables = prompt.variables as any[];

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