import { z } from 'zod';
import * as cron from 'node-cron';
import crypto from 'crypto';

import prisma from '../lib/prisma';

// Validation schemas for trigger operations
export const CreateTriggerSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK', 'API', 'EVENT']),
  isActive: z.boolean().optional().default(true),
  config: z.object({
    // SCHEDULED trigger config
    cron: z.string().optional(), // Cron expression for scheduled triggers
    timezone: z.string().optional(), // Timezone for scheduled triggers
    
    // WEBHOOK trigger config
    secret: z.string().optional(), // Webhook secret for HMAC validation
    allowedOrigins: z.array(z.string()).optional(), // Allowed request origins
    
    // API trigger config
    apiKey: z.string().optional(), // API key for authentication
    
    // EVENT trigger config
    eventType: z.string().optional(), // Type of event to listen for
    conditions: z.record(z.string(), z.any()).optional(), // Event conditions
  }).optional(),
});

export const UpdateTriggerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  type: z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK', 'API', 'EVENT']).optional(),
  config: z.record(z.string(), z.any()).optional(),
});

/**
 * Service for managing workflow triggers and scheduling
 */
export class TriggerService {
  private scheduledTasks = new Map<string, cron.ScheduledTask>();
  
  private normalizeTrigger<T>(trigger: T): T {
    if (!trigger) return trigger;
    try {
      const cfgRaw = (trigger as any).config;
      if (cfgRaw && typeof cfgRaw === 'string') {
        (trigger as any).config = JSON.parse(cfgRaw);
      }
    } catch {
      // leave as-is if parse fails
    }
    return trigger;
  }

  /**
   * Execute a trigger by ID, creating a workflow execution and starting it.
   * If input is not provided, this will build sample input from required workflow variables.
   */
  async runTrigger(triggerId: string, requestedByUserId?: string, options?: { input?: Record<string, any>; triggerTypeOverride?: string }) {
    // Load trigger with workflow and ensure ownership if requestedByUserId is provided
    const trigger = await prisma.workflowTrigger.findFirst({
      where: {
        id: triggerId,
        ...(requestedByUserId ? { workflow: { userId: requestedByUserId } } : {}),
      },
      include: {
        workflow: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
              include: {
                // Ensure prompt content/variables are available for PROMPT steps
                prompt: { select: { id: true, name: true, content: true, variables: true } },
              },
            },
            variables: true,
          }
        }
      }
    });

    if (!trigger || !trigger.workflow) {
      throw new Error('Trigger not found or access denied');
    }

    // Prepare input
    const provided = options?.input || {};
    const inputVars = (trigger.workflow.variables || []).filter((v: any) => v.type === 'input');
    const buildPlaceholder = (dt: string, name: string): any => {
      switch (dt) {
        case 'number': return 1;
        case 'boolean': return false;
        case 'array': return [];
        case 'object': return { example: `${name}Value` };
        default: return `Sample ${name}`;
      }
    };
    const input: Record<string, any> = { ...provided };
    for (const v of inputVars) {
      const has = Object.prototype.hasOwnProperty.call(input, v.name);
      if (!has) {
        // Prefer defaultValue when present
        let def: any = undefined;
        try { def = v.defaultValue; } catch { def = undefined; }
        input[v.name] = def !== undefined && def !== null ? def : buildPlaceholder(v.dataType, v.name);
      }
    }

    // Create execution record and launch
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: trigger.workflowId,
        triggerId: trigger.id,
        input: JSON.stringify(input),
        output: JSON.stringify({}),
        status: 'PENDING',
        metadata: JSON.stringify({
          stepCount: trigger.workflow.steps.length,
          triggerType: (options?.triggerTypeOverride || String(trigger.type || 'manual')).toLowerCase(),
          triggerName: trigger.name,
        }),
      }
    });

    // Fire-and-forget execution using dynamic import to avoid circular/early load issues in tests
    const { workflowService } = await import('./workflowService');
    workflowService.executeWorkflowSteps(execution.id, trigger.workflow as any, input)
      .catch((error: any) => {
        // Log but do not throw
        console.error(`Error executing workflow via trigger ${trigger.id}:`, error);
      });

    // Update lastTriggeredAt
    await prisma.workflowTrigger.update({ where: { id: trigger.id }, data: { lastTriggeredAt: new Date() } });

    return execution;
  }

  /**
   * Create a new workflow trigger
   */
  async createTrigger(workflowId: string, userId: string, data: any) {
    const validated = CreateTriggerSchema.parse(data);

    // Verify workflow exists and belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId }
    });

    if (!workflow) {
      throw new Error('Workflow not found or access denied');
    }

    // Validate trigger-specific configuration
    await this.validateTriggerConfig(validated.type as any, validated.config || {});

    const trigger = await prisma.workflowTrigger.create({
      data: {
        name: validated.name,
        type: validated.type as any,
        isActive: validated.isActive,
        config: JSON.stringify(validated.config || {}),
        workflowId,
      },
      include: {
        workflow: true,
      }
    });

    // Set up scheduled task if it's a scheduled trigger
    if (trigger.type === 'SCHEDULED' && trigger.isActive) {
      await this.setupScheduledTask(trigger);
    }

    return this.normalizeTrigger(trigger);
  }

  /**
   * Get trigger by ID
   */
  async getTriggerById(triggerId: string, userId: string) {
    const trigger = await prisma.workflowTrigger.findFirst({
      where: {
        id: triggerId,
        workflow: { userId }
      },
      include: {
        workflow: true,
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10
        }
      }
    });

    return this.normalizeTrigger(trigger);
  }

  /**
   * List triggers for a workflow
   */
  async getWorkflowTriggers(workflowId: string, userId: string) {
    const list = await prisma.workflowTrigger.findMany({
      where: {
        workflowId,
        workflow: { userId }
      },
      include: {
        workflow: true,
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  return list.map((t: any) => this.normalizeTrigger(t));
  }

  /**
   * Update trigger
   */
  async updateTrigger(triggerId: string, userId: string, data: any) {
    const validated = UpdateTriggerSchema.parse(data);

    // Check trigger exists and user has access
    const existingTrigger = await this.getTriggerById(triggerId, userId);
    if (!existingTrigger) {
      throw new Error('Trigger not found or access denied');
    }

    // Stop existing scheduled task early if we will change schedule or type
    if (existingTrigger.type === 'SCHEDULED') {
      this.stopScheduledTask(triggerId);
    }

    const updateData: any = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
    const typeChanged = validated.type && validated.type !== existingTrigger.type;
    if (validated.type) {
      updateData.type = validated.type;
    }

    // Prepare new config depending on whether type changed
    const existingConfig = (() => {
      try { return JSON.parse(existingTrigger.config as string) || {}; } catch { return {}; }
    })();
    let nextConfig: Record<string, any> | undefined = undefined;
    if (validated.config || typeChanged) {
      if (typeChanged) {
        // Replace config when changing type to avoid stale fields
        nextConfig = { ...(validated.config || {}) };
      } else {
        nextConfig = { ...existingConfig, ...(validated.config || {}) };
      }
    }

    // Validate and auto-fill config based on final target type
    const targetType = (validated.type || existingTrigger.type) as string;
    if (nextConfig) {
      // validateTriggerConfig may add fields (e.g., secret/apiKey)
      await this.validateTriggerConfig(targetType, nextConfig);
      updateData.config = JSON.stringify(nextConfig);
    }

    const updatedTrigger = await prisma.workflowTrigger.update({
      where: { id: triggerId },
      data: updateData,
      include: {
        workflow: true,
      }
    });

    // Restart scheduled task if it's active and scheduled
    if (updatedTrigger.type === 'SCHEDULED' && updatedTrigger.isActive) {
      await this.setupScheduledTask(updatedTrigger);
    }

    return this.normalizeTrigger(updatedTrigger);
  }

  /**
   * Delete trigger
   */
  async deleteTrigger(triggerId: string, userId: string): Promise<boolean> {
    const trigger = await this.getTriggerById(triggerId, userId);
    if (!trigger) {
      throw new Error('Trigger not found or access denied');
    }

    // Stop scheduled task if exists
    if (trigger.type === 'SCHEDULED') {
      this.stopScheduledTask(triggerId);
    }

    await prisma.workflowTrigger.delete({
      where: { id: triggerId }
    });

    return true;
  }

  /**
   * Initialize all scheduled triggers on service startup
   */
  async initializeScheduledTriggers(): Promise<void> {
    console.log('Initializing scheduled triggers...');
    
    const scheduledTriggers = await prisma.workflowTrigger.findMany({
      where: {
        type: 'SCHEDULED',
        isActive: true,
      },
      include: { workflow: true }
    });

    // Filter triggers that have cron configuration
    const validTriggers = scheduledTriggers.filter((trigger: any) => {
      try {
        const config = JSON.parse(trigger.config as string);
        return config.cron;
      } catch {
        return false;
      }
    });

    for (const trigger of validTriggers) {
      try {
        await this.setupScheduledTask(trigger);
        console.log(`Scheduled trigger ${trigger.name} initialized`);
      } catch (error) {
        console.error(`Failed to initialize trigger ${trigger.name}:`, error);
      }
    }

    console.log(`Initialized ${validTriggers.length} scheduled triggers`);
  }

  /**
   * Stop all scheduled triggers (for service shutdown)
   */
  async stopAllScheduledTriggers(): Promise<void> {
    console.log('Stopping all scheduled triggers...');
    
    for (const [triggerId, task] of this.scheduledTasks) {
      try {
        task.stop();
        this.scheduledTasks.delete(triggerId);
        console.log(`Stopped trigger ${triggerId}`);
      } catch (error) {
        console.error(`Error stopping trigger ${triggerId}:`, error);
      }
    }
    
    console.log('All scheduled triggers stopped');
  }

  /**
   * Private method to validate trigger configuration
   */
  private async validateTriggerConfig(type: string, config: Record<string, any>): Promise<void> {
    switch (type) {
      case 'SCHEDULED':
        if (!config.cron) {
          throw new Error('Cron expression is required for scheduled triggers');
        }
        if (!cron.validate(config.cron)) {
          throw new Error('Invalid cron expression');
        }
        break;

      case 'WEBHOOK':
        // Generate webhook secret if not provided
        if (!config.secret) {
          config.secret = crypto.randomBytes(32).toString('hex');
        }
        break;

      case 'API':
        // Generate API key if not provided
        if (!config.apiKey) {
          config.apiKey = crypto.randomBytes(32).toString('hex');
        }
        break;

      case 'MANUAL':
      case 'EVENT':
        // No specific validation needed
        break;

      default:
        throw new Error(`Unsupported trigger type: ${type}`);
    }
  }

  /**
   * Private method to setup a scheduled task
   */
  private async setupScheduledTask(trigger: any): Promise<void> {
    const config = JSON.parse(trigger.config as string);
    
    if (!config.cron) {
      throw new Error('Cron expression not found in trigger config');
    }

    // Stop existing task if any
    this.stopScheduledTask(trigger.id);

    const task = cron.schedule(
      config.cron,
      async () => {
        try {
          console.log(`Executing scheduled trigger: ${trigger.name}`);
          await this.runTrigger(trigger.id, undefined, { triggerTypeOverride: 'scheduled' });
          console.log(`Scheduled trigger ${trigger.name} executed successfully`);
        } catch (error) {
          console.error(`Error executing scheduled trigger ${trigger.name}:`, error);
        }
      },
      {
        timezone: config.timezone || 'UTC'
      }
    );

    task.start();
    this.scheduledTasks.set(trigger.id, task);

    console.log(`Next run time for ${trigger.name}: ${new Date(Date.now() + 60000)}`);
  }

  /**
   * Private method to stop a scheduled task
   */
  private stopScheduledTask(triggerId: string): void {
    const task = this.scheduledTasks.get(triggerId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(triggerId);
    }
  }
}

export const triggerService = new TriggerService();