import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { CreateTriggerSchema, UpdateTriggerSchema, triggerService } from '../services/triggerService';

const router = Router();
const prisma = new PrismaClient();

// GET /api/workflows/:workflowId/triggers - List triggers for a workflow
router.get('/:workflowId/triggers', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { workflowId } = req.params;
    if (!workflowId) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    const triggers = await triggerService.getWorkflowTriggers(workflowId, userId);
    res.json(triggers);

  } catch (error) {
    console.error('Error fetching triggers:', error);
    res.status(500).json({ error: 'Failed to fetch triggers' });
  }
});

// POST /api/workflows/:workflowId/triggers - Create a new trigger
router.post('/:workflowId/triggers', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { workflowId } = req.params;
    if (!workflowId) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    const trigger = await triggerService.createTrigger(workflowId, userId, req.body);
    res.status(201).json(trigger);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error creating trigger:', error);
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

// GET /api/triggers/:id - Get trigger by ID
router.get('/triggers/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Trigger ID is required' });
    }

    const trigger = await triggerService.getTriggerById(id, userId);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json(trigger);

  } catch (error) {
    console.error('Error fetching trigger:', error);
    res.status(500).json({ error: 'Failed to fetch trigger' });
  }
});

// PUT /api/triggers/:id - Update trigger
router.put('/triggers/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Trigger ID is required' });
    }

    const trigger = await triggerService.updateTrigger(id, userId, req.body);
    res.json(trigger);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    console.error('Error updating trigger:', error);
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

// DELETE /api/triggers/:id - Delete trigger
router.delete('/triggers/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Trigger ID is required' });
    }

    await triggerService.deleteTrigger(id, userId);
    res.status(204).send();

  } catch (error) {
    console.error('Error deleting trigger:', error);
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

// POST /api/triggers/:id/execute - Execute trigger manually
router.post('/triggers/:id/execute', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Trigger ID is required' });
    }

    // For now, just acknowledge the request
    // TODO: Implement actual trigger execution
    const trigger = await triggerService.getTriggerById(id, userId);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({ 
      message: 'Trigger execution requested', 
      triggerId: id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Error executing trigger:', error);
    res.status(500).json({ error: 'Failed to execute trigger' });
  }
});

// POST /api/webhooks/:triggerId - Handle webhook trigger
router.post('/webhooks/:triggerId', async (req, res) => {
  try {
    const { triggerId } = req.params;
    if (!triggerId) {
      return res.status(400).json({ error: 'Trigger ID is required' });
    }

    const signature = req.headers['x-hub-signature-256'] as string;
    const origin = req.headers['origin'] as string;
    
    // For now, just acknowledge the webhook
    // TODO: Implement actual webhook handling and validation
    console.log(`Received webhook for trigger ${triggerId}`);
    
    res.status(200).json({ 
      message: 'Webhook received', 
      triggerId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Failed to handle webhook' });
  }
});

export default router;