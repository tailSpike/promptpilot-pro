import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional().default(true),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const CreateStepSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['PROMPT', 'CONDITION', 'TRANSFORM', 'DELAY', 'WEBHOOK', 'DECISION']),
  order: z.number().int().min(0),
  promptId: z.string().optional(),
  config: z.record(z.string(), z.any()).default({}),
});

const ExecuteWorkflowSchema = z.object({
  input: z.record(z.string(), z.any()),
  triggerType: z.string().optional(),
});

// GET /api/workflows - List all workflows for user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      folderId,
      search,
      limit = '20',
      offset = '0'
    } = req.query;

    const whereClause: any = {
      userId
    };

    if (folderId) whereClause.folderId = folderId;
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } }
      ];
    }

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where: whereClause,
        include: {
          steps: {
            select: { id: true, order: true },
            orderBy: { order: 'asc' }
          },
          user: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { executions: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: parseInt(offset as string),
        take: parseInt(limit as string),
      }),
      prisma.workflow.count({ where: whereClause })
    ]);

    res.json({
      workflows,
      total,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + workflows.length
      }
    });

  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// GET /api/workflows/:id - Get specific workflow
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            prompt: {
              select: { id: true, name: true, content: true, variables: true }
            }
          }
        },
        user: {
          select: { id: true, name: true, email: true }
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            startedAt: true,
            input: true,
            output: true
          }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);

  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// POST /api/workflows - Create new workflow
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = CreateWorkflowSchema.parse(req.body);

    const workflow = await prisma.workflow.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        isActive: validatedData.isActive,
        userId
      },
      include: {
        steps: true,
        user: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { executions: true }
        }
      }
    });

    res.status(201).json(workflow);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// PUT /api/workflows/:id - Update workflow
router.put('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const validatedData = UpdateWorkflowSchema.parse(req.body);

    // Check if workflow exists and belongs to user
    const existing = await prisma.workflow.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        user: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { executions: true }
        }
      }
    });

    res.json(workflow);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const result = await prisma.workflow.deleteMany({
      where: {
        id,
        userId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ message: 'Workflow deleted successfully' });

  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// POST /api/workflows/:id/steps - Add step to workflow
router.post('/:id/steps', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const validatedData = CreateStepSchema.parse(req.body);

    // Check if workflow exists and belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const step = await prisma.workflowStep.create({
      data: {
        workflowId: id!,
        name: validatedData.name,
        type: validatedData.type,
        order: validatedData.order,
        promptId: validatedData.promptId || undefined,
        config: JSON.stringify(validatedData.config)
      },
      include: {
        prompt: {
          select: { id: true, name: true, content: true }
        }
      }
    });

    res.status(201).json(step);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating step:', error);
    res.status(500).json({ error: 'Failed to create step' });
  }
});

// POST /api/workflows/:id/execute - Execute workflow
router.post('/:id/execute', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const validatedData = ExecuteWorkflowSchema.parse(req.body);

    // Check if workflow exists and belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            prompt: {
              select: { id: true, name: true, content: true, variables: true }
            }
          }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: id!,
        input: JSON.stringify(validatedData.input),
        output: JSON.stringify({}), // Initialize with empty output
        status: 'PENDING',
        metadata: JSON.stringify({
          stepCount: workflow.steps.length,
          triggerType: validatedData.triggerType || 'manual'
        })
      }
    });

    // Simulate simple execution (just update status)
    setTimeout(async () => {
      try {
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            output: JSON.stringify({
              message: 'Workflow completed successfully',
              steps: workflow.steps.length,
              finalResult: validatedData.input
            })
          }
        });
      } catch (error) {
        console.error('Error completing workflow:', error);
      }
    }, 2000); // Simulate 2-second execution

    res.status(201).json(execution);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: 'Failed to execute workflow' });
  }
});

// GET /api/workflows/:id/executions - Get execution history
router.get('/:id/executions', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    // Check if workflow exists and belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId },
      select: { id: true }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where: { workflowId: id },
        orderBy: { startedAt: 'desc' },
        skip: parseInt(offset as string),
        take: parseInt(limit as string),
      }),
      prisma.workflowExecution.count({ where: { workflowId: id } })
    ]);

    res.json({
      executions,
      total,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + executions.length
      }
    });

  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

export default router;