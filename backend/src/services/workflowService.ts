import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Define step types as constants (since SQLite doesn't support enums natively)
export const StepTypes = {
  PROMPT: 'PROMPT',
  CONDITION: 'CONDITION', 
  TRANSFORM: 'TRANSFORM',
  DELAY: 'DELAY',
  WEBHOOK: 'WEBHOOK',
  DECISION: 'DECISION'
} as const;

export type StepType = typeof StepTypes[keyof typeof StepTypes];

export const ExecutionStatuses = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING', 
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export type ExecutionStatus = typeof ExecutionStatuses[keyof typeof ExecutionStatuses];

// Validation schemas for workflow operations
export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  folderId: z.string().optional(),
  isTemplate: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const CreateWorkflowStepSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['PROMPT', 'CONDITION', 'TRANSFORM', 'DELAY', 'WEBHOOK', 'DECISION']),
  order: z.number().int().min(0),
  promptId: z.string().optional(),
  config: z.record(z.string(), z.any()),
  inputs: z.record(z.string(), z.any()).optional(),
  outputs: z.record(z.string(), z.any()).optional(),
  conditions: z.record(z.string(), z.any()).optional(),
});

export const CreateWorkflowVariableSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['input', 'output', 'intermediate']),
  dataType: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  defaultValue: z.any().optional(),
  isRequired: z.boolean().optional(),
  validation: z.record(z.string(), z.any()).optional(),
});

// Type definitions for service operations
export interface CreateWorkflowData {
  name: string;
  description?: string;
  folderId?: string;
  isTemplate?: boolean;
  tags?: string[];
  steps?: CreateWorkflowStepData[];
  variables?: CreateWorkflowVariableData[];
}

export interface CreateWorkflowStepData {
  name: string;
  type: StepType;
  order: number;
  promptId?: string;
  config: Record<string, any>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  conditions?: Record<string, any>;
}

export interface CreateWorkflowVariableData {
  name: string;
  type: 'input' | 'output' | 'intermediate';
  dataType: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  defaultValue?: any;
  isRequired?: boolean;
  validation?: Record<string, any>;
}

export interface ExecuteWorkflowData {
  input: Record<string, any>;
  triggerType?: string;
}

// Since the Prisma generated types aren't available yet, we'll define them manually
export interface WorkflowVariable {
  id: string;
  name: string;
  type: string;
  dataType: string;
  description?: string | null;
  defaultValue?: any;
  isRequired: boolean;
  validation?: any;
  workflowId: string;
}

export interface WorkflowStepExecution {
  id: string;
  stepOrder: number;
  input?: any;
  output?: any;
  status: string;
  startedAt: Date;
  completedAt?: Date | null;
  duration?: number | null;
  error?: any;
  retryCount: number;
  executionId: string;
  stepId: string;
}

export interface WorkflowWithRelations {
  id: string;
  name: string;
  description?: string | null;
  steps: (any & { prompt?: any; order: number; type: string; name: string; config: any })[];
  variables?: WorkflowVariable[];
  executions?: any[];
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  folder?: {
    id: string;
    name: string;
    color: string | null;
  };
}

export class WorkflowService {
  /**
   * Create a new workflow with steps and variables
   */
  async createWorkflow(userId: string, data: CreateWorkflowData): Promise<WorkflowWithRelations> {
    const validated = CreateWorkflowSchema.parse(data);
    
    const workflow = await prisma.workflow.create({
      data: {
        name: validated.name,
        description: validated.description,
        userId,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Create steps if provided
    if (data.steps && data.steps.length > 0) {
      await prisma.workflowStep.createMany({
        data: data.steps.map(step => ({
          workflowId: workflow.id,
          name: step.name,
          type: step.type,
          order: step.order,
          ...(step.promptId && { promptId: step.promptId }),
          config: JSON.stringify(step.config),
          inputs: step.inputs ? JSON.stringify(step.inputs) : undefined,
          outputs: step.outputs ? JSON.stringify(step.outputs) : undefined,
          conditions: step.conditions ? JSON.stringify(step.conditions) : undefined,
        }))
      });
    }

    // Create variables if provided  
    if (data.variables && data.variables.length > 0) {
      await prisma.workflowVariable.createMany({
        data: data.variables.map(variable => ({
          workflowId: workflow.id,
          name: variable.name,
          type: variable.type,
          dataType: variable.dataType,
          description: variable.description,
          defaultValue: variable.defaultValue ? JSON.stringify(variable.defaultValue) : undefined,
          isRequired: variable.isRequired || false,
          validation: variable.validation ? JSON.stringify(variable.validation) : undefined,
        }))
      });
    }

    // Return workflow with created relations
    return this.getWorkflowById(workflow.id, userId) as Promise<WorkflowWithRelations>;
  }

  /**
   * Get workflow by ID with all relations
   */
  async getWorkflowById(workflowId: string, userId: string): Promise<WorkflowWithRelations | null> {
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
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
        folder: {
          select: { id: true, name: true, color: true }
        },
        executions: {
          orderBy: { id: 'desc' },
          take: 5, // Latest 5 executions
          select: {
            id: true,
            status: true,
            input: true,
            output: true
          }
        }
      }
    });

    if (!workflow) return null;

    // Get variables separately since they're not in the include
    const variables = await prisma.workflowVariable.findMany({
      where: { workflowId }
    });

    return {
      ...workflow,
      variables
    } as WorkflowWithRelations;
  }

  /**
   * List all workflows for a user with filtering and pagination
   */
  async getUserWorkflows(
    userId: string,
    options: {
      folderId?: string;
      isTemplate?: boolean;
      search?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ workflows: WorkflowWithRelations[]; total: number }> {
    const {
      folderId,
      isTemplate,
      search,
      tags,
      limit = 20,
      offset = 0
    } = options;

    const where: any = {
      userId,
      ...(folderId !== undefined && { folderId }),
      ...(isTemplate !== undefined && { isTemplate }),
    };

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        include: {
          steps: {
            select: { 
              id: true, 
              name: true, 
              type: true, 
              order: true,
              promptId: true,
              position: true,
              config: true,
              inputs: true,
              outputs: true,
              conditions: true,
              retryConfig: true,
              workflowId: true
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          },
          folder: {
            select: { id: true, name: true, color: true }
          },
          _count: {
            select: { executions: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.workflow.count({ where })
    ]);

    // Filter by tags if specified (since SQLite doesn't support JSON operations easily)
    let filteredWorkflows = workflows as any[];
    if (tags && tags.length > 0) {
      filteredWorkflows = (workflows as any[]).filter((workflow: any) => {
        if (!workflow.tags) return false;
        const workflowTags = JSON.parse(workflow.tags as string) as string[];
        return tags.some(tag => workflowTags.includes(tag));
      });
    }

    // Get variables for each workflow
    const workflowsWithVariables = await Promise.all(
      filteredWorkflows.map(async (workflow: any) => {
        const variables = await prisma.workflowVariable.findMany({
          where: { workflowId: workflow.id },
          select: { id: true, name: true, type: true, dataType: true, isRequired: true, workflowId: true }
        });
        return { ...workflow, variables };
      })
    );

    return {
      workflows: workflowsWithVariables as WorkflowWithRelations[],
      total: tags && tags.length > 0 ? filteredWorkflows.length : total
    };
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    workflowId: string,
    userId: string,
    data: Partial<CreateWorkflowData>
  ): Promise<WorkflowWithRelations | null> {
    // Check ownership
    const existing = await prisma.workflow.findFirst({
      where: { id: workflowId, userId }
    });

    if (!existing) {
      return null;
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.folderId !== undefined) updateData.folderId = data.folderId;
    if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

    await prisma.workflow.update({
      where: { id: workflowId },
      data: updateData
    });

    return this.getWorkflowById(workflowId, userId);
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string, userId: string): Promise<boolean> {
    const result = await prisma.workflow.deleteMany({
      where: {
        id: workflowId,
        userId
      }
    });

    return result.count > 0;
  }

  /**
   * Execute a workflow with the provided input
   */
  async executeWorkflow(
    workflowId: string,
    userId: string,
    data: ExecuteWorkflowData
  ): Promise<any | null> {
    // Get workflow with steps
    const workflow = await this.getWorkflowById(workflowId, userId);
    if (!workflow) {
      return null;
    }

    // Validate input against workflow variables
    const inputVariables = (workflow.variables || []).filter(v => v.type === 'input');
    const validationError = this.validateWorkflowInput(data.input, inputVariables);
    if (validationError) {
      throw new Error(`Input validation failed: ${validationError}`);
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        input: JSON.stringify(data.input),
        status: ExecutionStatuses.PENDING,
        metadata: JSON.stringify({
          stepCount: workflow.steps.length,
          inputVariableCount: inputVariables.length,
        }),
      }
    });

    // Start execution asynchronously
    this.executeWorkflowSteps(execution.id, workflow, data.input).catch((error: any) => {
      console.error(`Workflow execution ${execution.id} failed:`, error);
      // Update execution status to failed
      prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatuses.FAILED,
          error: JSON.stringify({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          }),
        }
      }).catch((updateError: any) => {
        console.error(`Failed to update execution status:`, updateError);
      });
    });

    return execution;
  }

  /**
   * Get execution history for a workflow
   */
  async getWorkflowExecutions(
    workflowId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ executions: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    // Verify ownership
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
      select: { id: true }
    });

    if (!workflow) {
      return { executions: [], total: 0 };
    }

    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where: { workflowId },
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.workflowExecution.count({ where: { workflowId } })
    ]);

    return { executions, total };
  }

  /**
   * Private method to execute workflow steps sequentially
   */
  private async executeWorkflowSteps(
    executionId: string,
    workflow: WorkflowWithRelations,
    initialInput: Record<string, any>
  ): Promise<void> {
    // Update status to running
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: ExecutionStatuses.RUNNING }
    });

    let currentInput = { ...initialInput };
    const stepResults: Record<string, any> = {};

    try {
      // Execute steps in order
      for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
        // Execute the step based on its type
        const stepOutput = await this.executeStep(step, currentInput);
        
        // Store step result for future steps
        stepResults[`step_${step.order}`] = stepOutput;
        
        // Merge step output into current input for next step
        if (stepOutput && typeof stepOutput === 'object') {
          currentInput = { ...currentInput, ...stepOutput };
        }
      }

      // All steps completed successfully
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatuses.COMPLETED,
          output: JSON.stringify({
            finalResult: currentInput,
            stepResults,
          }),
        }
      });

    } catch (error: any) {
      // Workflow failed
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatuses.FAILED,
          error: JSON.stringify({
            message: error.message,
            stack: error.stack,
            stepResults,
          }),
        }
      });
      throw error;
    }
  }

  /**
   * Execute an individual workflow step
   */
  private async executeStep(step: any & { prompt?: any; order: number; type: string; name: string; config: any }, input: Record<string, any>): Promise<any> {
    const config = JSON.parse(step.config as string);
    
    switch (step.type) {
      case StepTypes.PROMPT:
        if (!step.prompt) {
          throw new Error(`Prompt step ${step.name} has no associated prompt`);
        }
        return await this.executePromptStep(step.prompt, input, config);
        
      case StepTypes.TRANSFORM:
        return this.executeTransformStep(input, config);
        
      case StepTypes.CONDITION:
        return this.executeConditionStep(input, config);
        
      case StepTypes.DELAY:
        return this.executeDelayStep(config);
        
      case StepTypes.WEBHOOK:
        return this.executeWebhookStep(input, config);
        
      case StepTypes.DECISION:
        return this.executeDecisionStep(input, config);
        
      default:
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }

  /**
   * Execute a prompt step with variable substitution
   */
  private async executePromptStep(prompt: any, input: Record<string, any>, config: any): Promise<any> {
    // This is a simplified implementation - in a real system, you'd integrate with AI models
    const variables = JSON.parse(prompt.variables || '[]');
    let content = prompt.content;

    // Simple variable substitution
    for (const variable of variables) {
      const value = input[variable.name] || variable.defaultValue || '';
      content = content.replace(new RegExp(`{{${variable.name}}}`, 'g'), value);
    }

    // Simulate AI model execution
    return {
      content,
      generatedText: `Generated response for: ${content.substring(0, 100)}...`,
      model: config.model || 'gpt-3.5-turbo',
      tokens: Math.floor(Math.random() * 1000) + 100,
    };
  }

  /**
   * Execute a transform step (data manipulation)
   */
  private executeTransformStep(input: Record<string, any>, config: any): any {
    // Simple data transformation based on config
    const result = { ...input };
    
    if (config.transformations) {
      for (const [key, transformation] of Object.entries(config.transformations)) {
        const transformConfig = transformation as any;
        switch (transformConfig.type) {
          case 'uppercase':
            if (result[key]) result[key] = String(result[key]).toUpperCase();
            break;
          case 'lowercase':
            if (result[key]) result[key] = String(result[key]).toLowerCase();
            break;
          case 'number':
            result[key] = Number(result[key]) || 0;
            break;
          case 'concat':
            result[key] = transformConfig.values.join(transformConfig.separator || '');
            break;
        }
      }
    }

    return result;
  }

  /**
   * Execute a conditional step
   */
  private executeConditionStep(input: Record<string, any>, config: any): any {
    const condition = config.condition;
    let conditionMet = false;

    // Simple condition evaluation
    if (condition.type === 'equals') {
      conditionMet = input[condition.variable] === condition.value;
    } else if (condition.type === 'greater_than') {
      conditionMet = Number(input[condition.variable]) > Number(condition.value);
    } else if (condition.type === 'contains') {
      conditionMet = String(input[condition.variable]).includes(condition.value);
    }

    return {
      conditionMet,
      branch: conditionMet ? 'true' : 'false',
      ...input,
    };
  }

  /**
   * Execute a delay step
   */
  private async executeDelayStep(config: any): Promise<any> {
    const delayMs = config.delayMs || 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return { delayed: true, delayMs };
  }

  /**
   * Execute a webhook step
   */
  private async executeWebhookStep(input: Record<string, any>, config: any): Promise<any> {
    // Simplified webhook implementation
    return {
      webhookCalled: true,
      url: config.url,
      method: config.method || 'POST',
      input,
      response: { status: 200, message: 'Simulated webhook response' },
    };
  }

  /**
   * Execute a decision step (manual intervention)
   */
  private async executeDecisionStep(input: Record<string, any>, config: any): Promise<any> {
    // In a real implementation, this would pause execution and wait for user input
    return {
      decision: 'auto-approved', // Simplified for now
      options: config.options || ['approve', 'reject'],
      ...input,
    };
  }

  /**
   * Validate workflow input against required variables
   */
  private validateWorkflowInput(input: Record<string, any>, inputVariables: WorkflowVariable[]): string | null {
    for (const variable of inputVariables) {
      if (variable.isRequired && !(variable.name in input)) {
        return `Required variable '${variable.name}' is missing`;
      }

      if (variable.name in input) {
        const value = input[variable.name];
        const expectedType = variable.dataType;

        // Type validation
        if (expectedType === 'string' && typeof value !== 'string') {
          return `Variable '${variable.name}' must be a string`;
        }
        if (expectedType === 'number' && typeof value !== 'number') {
          return `Variable '${variable.name}' must be a number`;
        }
        if (expectedType === 'boolean' && typeof value !== 'boolean') {
          return `Variable '${variable.name}' must be a boolean`;
        }
        if (expectedType === 'array' && !Array.isArray(value)) {
          return `Variable '${variable.name}' must be an array`;
        }
        if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
          return `Variable '${variable.name}' must be an object`;
        }

        // Custom validation rules
        if (variable.validation) {
          const validation = JSON.parse(variable.validation as string);
          if (validation.minLength && String(value).length < validation.minLength) {
            return `Variable '${variable.name}' must be at least ${validation.minLength} characters`;
          }
          if (validation.maxLength && String(value).length > validation.maxLength) {
            return `Variable '${variable.name}' must be at most ${validation.maxLength} characters`;
          }
          if (validation.min && Number(value) < validation.min) {
            return `Variable '${variable.name}' must be at least ${validation.min}`;
          }
          if (validation.max && Number(value) > validation.max) {
            return `Variable '${variable.name}' must be at most ${validation.max}`;
          }
        }
      }
    }

    return null;
  }
}

export const workflowService = new WorkflowService();