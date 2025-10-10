import { performance } from 'perf_hooks';
import { z } from 'zod';
import prisma from '../lib/prisma';
import {
  modelDispatcher,
  ModelConfig,
  ModelRoutingOptions,
  ModelExecutionResult,
} from './modelDispatcher';
import {
  IntegrationCredentialService,
  type ResolvedIntegrationCredential,
} from './integrationCredential.service';

const WORKFLOW_PROVIDER_TO_INTEGRATION_PROVIDER: Record<string, string | null> = {
  openai: 'openai',
  azure: 'azure_openai',
  anthropic: 'anthropic',
  google: 'gemini',
  custom: null,
};

interface StepExecutionContext {
  allowSimulatedFallback?: boolean;
  ownerId: string;
  credentialCache: Map<string, ResolvedIntegrationCredential | null>;
}

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
  // outputs allows aliasing parts of the step output to named variables available to later steps.
  // Example:
  // outputs: { facts: "extractedFacts", answer: { path: "generatedText" } }
  // This will expose {{facts}} and {{answer}} in subsequent prompts.
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

export interface WorkflowPreviewStepResult {
  stepId: string;
  name: string;
  type: string;
  order: number;
  startedAt: string;
  durationMs: number;
  inputSnapshot: Record<string, any>;
  output?: Record<string, any> | null;
  error?: {
    message: string;
    stack?: string;
  };
  warnings: string[];
  tokensUsed?: number;
}

export interface WorkflowPreviewResult {
  workflowId: string;
  status: 'COMPLETED' | 'FAILED';
  usedSampleData: boolean;
  input: Record<string, any>;
  finalOutput: Record<string, any> | null;
  totalDurationMs: number;
  stepResults: WorkflowPreviewStepResult[];
  stats: {
    stepsExecuted: number;
    tokensUsed: number;
  };
  warnings: string[];
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
  userId: string;
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
  private readonly defaultModelByProvider: Record<ModelConfig['provider'], string> = {
    openai: 'gpt-4o-mini',
    azure: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    google: 'gemini-1.5-flash',
    custom: 'custom-model',
  };

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

  async previewWorkflow(
    workflowId: string,
    userId: string,
    options: {
      input?: Record<string, any>;
      useSampleData?: boolean;
      triggerType?: string;
    } = {}
  ): Promise<WorkflowPreviewResult | null> {
    const workflow = await this.getWorkflowById(workflowId, userId);
    if (!workflow) {
      return null;
    }

    const inputVariables = (workflow.variables || []).filter(v => v.type === 'input');
    const baseInput = options.input ? { ...options.input } : {};
    const warnings: string[] = [];

    let usedSampleData = false;
    let preparedInput = { ...baseInput };
    const inputProvided = Object.keys(preparedInput).length > 0;
    const shouldAutoSample = options.useSampleData === true || (!inputProvided && options.useSampleData === undefined);

    if (shouldAutoSample) {
      const { sample, warnings: sampleWarnings } = this.buildSampleInput(inputVariables, preparedInput);
      preparedInput = sample;
      warnings.push(...sampleWarnings);
      usedSampleData = true;
    } else if (!inputProvided && options.useSampleData === false) {
      const requiredVariables = inputVariables.filter(variable => variable.isRequired).map(variable => variable.name);
      if (requiredVariables.length > 0) {
        warnings.push(`Missing required inputs: ${requiredVariables.join(', ')}`);
      }
    }

    const validationError = this.validateWorkflowInput(preparedInput, inputVariables);
    if (validationError) {
      throw new Error(validationError);
    }

    const stepResults: WorkflowPreviewStepResult[] = [];
    const credentialCache = new Map<string, ResolvedIntegrationCredential | null>();
    let currentInput = this.cloneData(preparedInput);
  let lastPromptOutput: Record<string, any> | null = null;
    let tokensUsed = 0;
    let overallStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';
    const previewStart = performance.now();

    for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
      const stepWarnings: string[] = [];
      const chainVars: Record<string, any> = {};
      if (lastPromptOutput && typeof lastPromptOutput === 'object') {
        const prevText = (lastPromptOutput as any).generatedText ?? (lastPromptOutput as any).text ?? (lastPromptOutput as any).outputText;
        if (prevText !== undefined) {
          chainVars.previous = prevText;
          chainVars.previousGeneratedText = prevText;
        }
        if ((lastPromptOutput as any).model) chainVars.previousModel = (lastPromptOutput as any).model;
        if ((lastPromptOutput as any).primaryProvider) chainVars.previousProvider = (lastPromptOutput as any).primaryProvider;
      }

      const effectiveInput = { ...currentInput, ...chainVars };
      const inputSnapshot = this.cloneData(effectiveInput);
      const stepStartedAt = new Date();
      const stepStartPerf = performance.now();

      let rawOutput: any;
      let normalizedOutput: Record<string, any> | null = null;
      let errorPayload: { message: string; stack?: string } | undefined;
      let stepTokens = 0;

      try {
        rawOutput = await this.executeStep(step, effectiveInput, {
          allowSimulatedFallback: true,
          ownerId: workflow.userId,
          credentialCache,
        });
        normalizedOutput = this.normalizePreviewOutput(rawOutput);

        if (!normalizedOutput || Object.keys(normalizedOutput).length === 0) {
          stepWarnings.push('Step returned no output payload.');
        }

        if (rawOutput && typeof rawOutput === 'object' && Array.isArray((rawOutput as any).warnings)) {
          stepWarnings.push(...(rawOutput as any).warnings);
        }

        if (rawOutput && typeof rawOutput === 'object' && 'tokens' in rawOutput) {
          const tokenValue = Number((rawOutput as any).tokens);
          if (!Number.isNaN(tokenValue)) {
            stepTokens = tokenValue;
            tokensUsed += tokenValue;
            if (tokenValue > 1500) {
              stepWarnings.push('High token usage detected for this step.');
            }
          }
        }

        if (step.type === StepTypes.CONDITION && rawOutput && typeof rawOutput === 'object' && 'branch' in rawOutput) {
          stepWarnings.push(`Condition evaluated branch "${(rawOutput as any).branch}".`);
        }

        if (rawOutput && typeof rawOutput === 'object') {
          // Apply preview of outputs aliasing similar to executeWorkflowSteps
          const parseJsonMaybe = (value: unknown): any => {
            if (value == null) return undefined;
            if (typeof value === 'string') { try { return JSON.parse(value); } catch { return undefined; } }
            if (typeof value === 'object') return value as any;
            return undefined;
          };
          const outputsConfig = parseJsonMaybe((step as any).outputs) as Record<string, any> | undefined;
          const getByPath = (obj: any, path: string): any => {
            if (!obj || !path) return undefined;
            const parts = String(path).split('.');
            let cur: any = obj;
            for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
            return cur;
          };
          const exportedAliases: Record<string, any> = {};
          if (outputsConfig && typeof outputsConfig === 'object') {
            for (const [alias, source] of Object.entries(outputsConfig)) {
              let path: string | undefined;
              if (typeof source === 'string') path = source;
              else if (source && typeof source === 'object' && typeof (source as any).path === 'string') path = (source as any).path;
              if (path) {
                const value = getByPath(rawOutput, path);
                if (value !== undefined) exportedAliases[alias] = value;
              }
            }
          }
          currentInput = { ...currentInput, ...rawOutput, ...exportedAliases };
          if (step.type === StepTypes.PROMPT) {
            lastPromptOutput = rawOutput as Record<string, any>;
          }
          if (normalizedOutput && Object.keys(exportedAliases).length > 0) {
            normalizedOutput.exported = exportedAliases;
          }
        }
      } catch (error: any) {
        overallStatus = 'FAILED';
        const message = error?.message || 'Unknown error occurred during step execution';
        errorPayload = {
          message,
          stack: process.env.NODE_ENV === 'test' ? undefined : error?.stack,
        };
        stepWarnings.push('Step execution failed. Preview halted at this step.');
      }

      const durationMs = performance.now() - stepStartPerf;

      stepResults.push({
        stepId: step.id,
        name: step.name,
        type: step.type,
        order: step.order,
        startedAt: stepStartedAt.toISOString(),
        durationMs,
        inputSnapshot,
        output: normalizedOutput,
        error: errorPayload,
        warnings: stepWarnings,
        tokensUsed: stepTokens || undefined,
      });

      warnings.push(...stepWarnings);

      if (errorPayload) {
        break;
      }
    }

    const totalDurationMs = performance.now() - previewStart;

    return {
      workflowId,
      status: overallStatus,
      usedSampleData,
      input: this.cloneData(preparedInput),
      finalOutput: overallStatus === 'COMPLETED' ? this.cloneData(currentInput) : null,
      totalDurationMs,
      stepResults,
      stats: {
        stepsExecuted: stepResults.length,
        tokensUsed,
      },
      warnings,
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
  /**
   * Execute workflow steps and update execution record (used for background execution)
   */
  async executeWorkflowSteps(
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
    const credentialCache = new Map<string, ResolvedIntegrationCredential | null>();
    // Track last prompt step output for automatic chaining
    let lastPromptOutput: Record<string, any> | null = null;

    try {
      // Execute steps in order
      for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
        const stepStartedAt = Date.now();

        // Built-in chaining variables from the previous prompt step
        const chainVars: Record<string, any> = {};
        if (lastPromptOutput && typeof lastPromptOutput === 'object') {
          const prevText = lastPromptOutput.generatedText ?? lastPromptOutput.text ?? lastPromptOutput.outputText;
          if (prevText !== undefined) {
            chainVars.previous = prevText;
            chainVars.previousGeneratedText = prevText;
          }
          if (lastPromptOutput.model) chainVars.previousModel = lastPromptOutput.model;
          if (lastPromptOutput.primaryProvider) chainVars.previousProvider = lastPromptOutput.primaryProvider;
        }

        // Compose the effective input for this step with chain vars
        const effectiveInput = { ...currentInput, ...chainVars };
        // Snapshot the input at the time of this step (useful for debugging chains)
        const inputSnapshot = this.cloneData(effectiveInput);

        // Execute the step based on its type
        const stepOutput = await this.executeStep(step, effectiveInput, {
          ownerId: workflow.userId,
          credentialCache,
        });
        
        // Preserve original output for chaining/exports; use a trace copy for UI offloading
        let traceOutput: any = this.cloneData(stepOutput);
        
        // Optional output aliasing: allow mapping fields from this step's output
        // into named variables for subsequent steps (configured in step.outputs).
        const parseJsonMaybe = (value: unknown): any => {
          if (value == null) return undefined;
          if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return undefined; }
          }
          if (typeof value === 'object') return value as any;
          return undefined;
        };

        const outputsConfig = parseJsonMaybe((step as any).outputs) as Record<string, any> | undefined;

        // Simple path resolver (supports dotted paths like "a.b.c")
        const getByPath = (obj: any, path: string): any => {
          if (!obj || !path) return undefined;
          const parts = String(path).split('.');
          let cur: any = obj;
          for (const p of parts) {
            if (cur == null) return undefined;
            cur = cur[p];
          }
          return cur;
        };

        const exportedAliases: Record<string, any> = {};
        if (outputsConfig && typeof outputsConfig === 'object') {
          for (const [alias, source] of Object.entries(outputsConfig)) {
            // Support either { alias: "generatedText" } or { alias: { path: "generatedText" } }
            let path: string | undefined;
            if (typeof source === 'string') {
              path = source;
            } else if (source && typeof source === 'object' && typeof (source as any).path === 'string') {
              path = (source as any).path as string;
            }
            if (path) {
              const value = getByPath(stepOutput, path);
              if (value !== undefined) {
                exportedAliases[alias] = value;
              }
            }
          }
        }

        // Offload large AI generated text per-step for visualization (keep original for chaining)
        try {
          const maybeText: string | undefined =
            (stepOutput && typeof stepOutput === 'object')
              ? (stepOutput as any).generatedText ?? (stepOutput as any).text ?? (stepOutput as any).outputText
              : undefined;
          if (typeof maybeText === 'string') {
            const { DocumentService } = await import('./document.service');
            const offload = await DocumentService.maybeOffloadLargeText(maybeText, workflow.userId, executionId);
            if (offload && offload.ref && !offload.inline) {
              const preview = (maybeText || '').slice(0, 4000);
              traceOutput = {
                ...(traceOutput || {}),
                generatedTextRef: { id: offload.ref.id, size: offload.ref.size, mimeType: offload.ref.mimeType, preview },
              };
              // Avoid duplicating huge inline content in traces
              if (traceOutput && typeof traceOutput === 'object') {
                delete (traceOutput as any).generatedText;
              }
            }
          }
        } catch (e) {
          console.warn('Per-step document offload skipped due to error:', e);
        }

        // Store step result with metadata for downstream visualization
        stepResults[`step_${step.order}`] = {
          meta: { id: step.id, name: step.name, type: step.type, order: step.order, outputsMapping: outputsConfig || undefined, chainVars: Object.keys(chainVars).length > 0 ? Object.keys(chainVars) : undefined },
          inputSnapshot,
          durationMs: Date.now() - stepStartedAt,
          output: traceOutput,
          exported: Object.keys(exportedAliases).length > 0 ? exportedAliases : undefined,
        };
        
        // Merge step output AND exported aliases into current input for next step
        if (stepOutput && typeof stepOutput === 'object') {
          currentInput = { ...currentInput, ...stepOutput, ...exportedAliases };
          if (step.type === StepTypes.PROMPT) {
            lastPromptOutput = stepOutput as Record<string, any>;
          }
        } else if (Object.keys(exportedAliases).length > 0) {
          currentInput = { ...currentInput, ...exportedAliases };
        }
      }

      // All steps completed successfully
      // Offload large generated text content if needed
  const finalPayload: any = { finalResult: currentInput, stepResults };

      try {
        const { DocumentService } = await import('./document.service');
        const ownerId = workflow.userId;

        const primaryText = (currentInput && typeof currentInput === 'object') ?
          (currentInput as any).generatedText as string | undefined : undefined;

        const offload = await DocumentService.maybeOffloadLargeText(primaryText, ownerId, executionId);
        if (offload) {
          if (offload.inline) {
            // keep as-is
          } else if (offload.ref) {
            // Replace inline with reference and keep a short preview
            const preview = (primaryText ?? '').slice(0, 4000);
            finalPayload.finalResult = {
              ...(currentInput || {}),
              generatedTextRef: { id: offload.ref.id, size: offload.ref.size, mimeType: offload.ref.mimeType, preview },
              generatedText: undefined,
            };
          }
        }
      } catch (e) {
        console.warn('Document offload skipped due to error:', e);
      }

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatuses.COMPLETED,
          output: JSON.stringify(finalPayload),
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
  private async executeStep(
    step: any & { prompt?: any; order: number; type: string; name: string; config: any },
    input: Record<string, any>,
    context: StepExecutionContext,
  ): Promise<any> {
    let config: any = {};
    if (typeof step.config === 'string') {
      try {
        config = step.config ? JSON.parse(step.config) : {};
      } catch (error) {
        throw new Error(`Invalid step configuration JSON for "${step.name}": ${(error as Error).message}`);
      }
    } else if (typeof step.config === 'object' && step.config !== null) {
      config = step.config;
    }
    
    switch (step.type) {
      case StepTypes.PROMPT: {
        const hasPromptRecord = Boolean(step.prompt);
        const inlinePrompt =
          typeof config?.promptContent === 'string' ? config.promptContent.trim() : '';

        if (!hasPromptRecord && inlinePrompt.length === 0) {
          throw new Error(`Prompt step ${step.name} has no associated prompt`);
        }
  return await this.executePromptStep(step, input, config, context);
      }
        
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
  private async executePromptStep(
    step: any,
    input: Record<string, any>,
    config: any,
    context: StepExecutionContext,
  ): Promise<any> {
    const promptRecord = step?.prompt ?? null;
    const inlineContent = typeof config?.promptContent === 'string' ? config.promptContent : undefined;
    const promptContent = promptRecord?.content ?? inlineContent;

    if (!promptContent || !promptContent.trim()) {
      const stepName = step?.name ?? 'Prompt step';
      throw new Error(`Prompt step "${stepName}" has no prompt content configured`);
    }

  const variables = this.parsePromptVariables(promptRecord?.variables);
    let content = promptContent;
    const resolvedVariables: Record<string, any> = {};

    const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaceAllPlaceholders = (tmpl: string, key: string, value: unknown): string => {
      const pattern = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g');
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return tmpl.replace(pattern, stringValue ?? '');
    };

    for (const variable of variables) {
      const mappedValue = config?.variables?.[variable.name];
      const value = input[variable.name] ?? mappedValue ?? variable.defaultValue ?? '';
      resolvedVariables[variable.name] = value;
      content = replaceAllPlaceholders(content, variable.name, value);
    }
    // Apply config variable mappings as fallback for unresolved placeholders
    if (config?.variables && typeof config.variables === 'object') {
      Object.entries(config.variables).forEach(([key, value]) => {
        if (resolvedVariables[key] === undefined) {
          const resolvedValue = input[key] ?? value ?? '';
          resolvedVariables[key] = resolvedValue;
          content = replaceAllPlaceholders(content, key, resolvedValue);
        }
      });
    }

    // Always allow direct input-based replacement for any remaining placeholders
    Object.entries(input).forEach(([key, value]) => {
      if (resolvedVariables[key] === undefined) {
        resolvedVariables[key] = value;
      }
      content = replaceAllPlaceholders(content, key, value);
    });

    // Detect unresolved placeholders after all substitutions
    const unresolvedPattern = /{{\s*[^}]+\s*}}/g;
    if (unresolvedPattern.test(content)) {
      // We'll append a warning later to the warnings array
    }

    const models = this.buildModelConfigs(config);
    const routing = this.buildRoutingConfig(config);

    const integrationProviders = models
      .map((model) => WORKFLOW_PROVIDER_TO_INTEGRATION_PROVIDER[model.provider] ?? null)
      .filter((providerId): providerId is string => Boolean(providerId));

    const resolvedCredentials = await this.loadProviderCredentials(
      context.ownerId,
      integrationProviders,
      context.credentialCache,
    );

  const dispatcherCredentials: Partial<Record<ModelConfig['provider'], ResolvedIntegrationCredential>> = {};
    const missingCredentialProviders: Set<string> = new Set();

    models.forEach((model) => {
      const integrationProvider = WORKFLOW_PROVIDER_TO_INTEGRATION_PROVIDER[model.provider] ?? null;
      if (!integrationProvider) {
        return;
      }
      const credential = resolvedCredentials[integrationProvider];
      if (credential) {
        dispatcherCredentials[model.provider] = credential;
      } else {
        missingCredentialProviders.add(model.provider);
      }
    });

    const dispatcherResult = await modelDispatcher.execute({
      prompt: content,
      instructions: config?.instructions,
      variables: input,
      models,
      routing,
    }, { credentials: dispatcherCredentials });

    const providerResults: ModelExecutionResult[] = [...dispatcherResult.results];
    const providersByName: Record<string, Record<string, any>> = {};
    const warnings: string[] = [];
    const errorSummaries: string[] = [];
    const failureMessages: string[] = [];

    if (missingCredentialProviders.size > 0) {
      warnings.push(
        `No active integration credential found for providers: ${Array.from(missingCredentialProviders).join(', ')}. Falling back to environment configuration or simulated output.`,
      );
    }

    providerResults.forEach((result) => {
      if (result.warnings && result.warnings.length > 0) {
        warnings.push(...result.warnings);
      }

      if (!result.success) {
        const failureMessage = result.error ?? 'unknown error';
        errorSummaries.push(`${result.provider}:${result.model} → ${failureMessage}`);
        failureMessages.push(failureMessage);
      }

      const providerKey = result.provider;
      providersByName[providerKey] = providersByName[providerKey] || {};
      providersByName[providerKey][result.model] = {
        label: result.label,
        text: result.outputText,
        success: result.success,
        tokens: result.tokensUsed,
        latencyMs: result.latencyMs,
        metadata: result.metadata,
        error: result.error,
        warnings: result.warnings,
      };

    });

    let primaryResult = this.selectPrimaryResult(providerResults);

    // If unresolved placeholders exist, add an explicit warning for visibility
    if (unresolvedPattern.test(content)) {
      warnings.push('Unresolved template variables detected in prompt content. Some placeholders may not have been replaced.');
    }

    if (!primaryResult) {
      const authErrorRegex = /(api\s*key|api-key|authentication|unauthorized|forbidden|invalid key)/i;
      const authOnlyFailures =
        context.allowSimulatedFallback &&
        providerResults.length > 0 &&
        providerResults.every(
          (result) =>
            !result.success &&
            typeof result.error === 'string' &&
            authErrorRegex.test(result.error),
        );

      if (authOnlyFailures && models.length > 0) {
        const fallbackModel = (models.find((model) => !model.disabled) ?? models[0])!;
        const simulatedText = this.buildSimulatedPreviewText(
          fallbackModel.label ?? fallbackModel.provider,
          content,
          resolvedVariables,
        );

        const simulatedResult: ModelExecutionResult = {
          provider: fallbackModel.provider,
          model: fallbackModel.model,
          label: fallbackModel.label,
          success: true,
          outputText: simulatedText,
          tokensUsed: 0,
          latencyMs: 0,
          warnings: ['Simulated preview output because provider authentication failed.'],
          raw: { simulated: true, reason: 'auth-fallback' },
          error: undefined,
          retries: 0,
          metadata: { simulated: true },
        };

        providerResults.push(simulatedResult);
        const providerKey = simulatedResult.provider;
        providersByName[providerKey] = providersByName[providerKey] || {};
        providersByName[providerKey][simulatedResult.model] = {
          label: simulatedResult.label,
          text: simulatedResult.outputText,
          success: true,
          tokens: simulatedResult.tokensUsed,
          latencyMs: simulatedResult.latencyMs,
          metadata: simulatedResult.metadata,
          error: undefined,
          warnings: simulatedResult.warnings,
        };

        primaryResult = simulatedResult;
        const fallbackWarning = 'All configured providers returned authentication errors. Showing simulated output for preview only.';
        warnings.push(fallbackWarning);
      }
    }

    if (!primaryResult) {
      const stepName = step?.name ?? 'Prompt step';
      const failureMessage = failureMessages[0] ?? 'All configured providers failed to generate output.';
      const error = new Error(`Prompt step "${stepName}" failed: ${failureMessage}`);
      if (errorSummaries.length > 0) {
        warnings.push(...errorSummaries);
      }
      throw error;
    }

    const primaryText = primaryResult.outputText ?? `Generated response for: ${content.substring(0, 100)}...`;
    const primaryModel = primaryResult.model ?? models[0]?.model ?? 'unknown-model';

    if (errorSummaries.length > 0) {
      warnings.push(...errorSummaries);
    }

    return {
      content,
      generatedText: primaryText,
      model: primaryModel,
      // Keep both fields for compatibility with older callers/tests
      tokensUsed: dispatcherResult.aggregatedTokens,
      tokens: dispatcherResult.aggregatedTokens,
      promptTokens: primaryResult.promptTokens,
      completionTokens: primaryResult.completionTokens,
      finishReason: primaryResult.finishReason,
      primaryProvider: primaryResult.provider ?? models[0]?.provider ?? 'openai',
      modelOutputs: providersByName,
      providerResults,
      resolvedVariables,
      warnings,
    };
  }

  private async loadProviderCredentials(
    ownerId: string,
    providers: string[],
    cache: Map<string, ResolvedIntegrationCredential | null>,
  ): Promise<Record<string, ResolvedIntegrationCredential>> {
    const result: Record<string, ResolvedIntegrationCredential> = {};
    const missingProviders: string[] = [];

    providers.forEach((provider) => {
      if (!provider) {
        return;
      }

      if (cache.has(provider)) {
        const cached = cache.get(provider);
        if (cached) {
          result[provider] = cached;
        }
        return;
      }

      missingProviders.push(provider);
    });

    if (missingProviders.length > 0) {
      const resolved = await IntegrationCredentialService.resolveActiveCredentials(ownerId, missingProviders);
      missingProviders.forEach((provider) => {
        const credential = resolved[provider] ?? null;
        cache.set(provider, credential);
        if (credential) {
          result[provider] = credential;
        }
      });
    }

    return result;
  }

  private buildSimulatedPreviewText(providerLabel: string, prompt: string, variables: Record<string, any>): string {
    const truncatedPrompt = prompt.length > 160 ? `${prompt.slice(0, 157)}...` : prompt;
    const entries = Object.entries(variables ?? {});
    const variableSummary = entries.length > 0
      ? entries
          .slice(0, 3)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key}: ${value}`;
            }
            try {
              return `${key}: ${JSON.stringify(value)}`;
            } catch {
              return `${key}: [unserializable]`;
            }
          })
          .join(', ')
      : '';

    const suffix = variableSummary
      ? ` | variables → ${variableSummary}${entries.length > 3 ? ', …' : ''}`
      : '';

    return `[Simulated ${providerLabel} preview] ${truncatedPrompt}${suffix}`;
  }

  private buildModelConfigs(config: any): ModelConfig[] {
    const rawModels = Array.isArray(config?.models) ? config.models : [];
    const allowedProviders = (process.env.ALLOWED_MODEL_PROVIDERS || 'openai,azure,anthropic,google,custom')
      .split(',')
      .map((provider) => provider.trim())
      .filter(Boolean);

    const normalized = rawModels
      .filter((candidate: any) => !!candidate)
      .map((candidate: any, index: number): ModelConfig => ({
        id: candidate.id || `model-${index}`,
        provider: (candidate.provider || 'openai') as ModelConfig['provider'],
        model:
          candidate.model ||
          config?.modelSettings?.model ||
          this.defaultModelByProvider[(candidate.provider || 'openai') as ModelConfig['provider']],
        label: candidate.label,
        disabled: candidate.disabled ?? false,
        parameters: candidate.parameters,
        retry: candidate.retry,
      }))
      .filter((model: ModelConfig) => {
        if (!allowedProviders.includes(model.provider)) {
          console.warn(`Model provider ${model.provider} is not allowed by ALLOWED_MODEL_PROVIDERS.`);
          return false;
        }
        return true;
      });

    if (normalized.length > 0) {
      return normalized;
    }

    return [
      {
        id: 'legacy-default-model',
        provider: (config?.modelSettings?.provider || config?.provider || 'openai') as ModelConfig['provider'],
        model:
          config?.modelSettings?.model ||
          this.defaultModelByProvider[(config?.modelSettings?.provider || config?.provider || 'openai') as ModelConfig['provider']],
        parameters: {
          temperature: config?.modelSettings?.temperature,
          topP: config?.modelSettings?.topP,
          maxTokens: config?.modelSettings?.maxTokens,
          parallelToolCalls: config?.modelSettings?.parallelToolCalls,
          metadata: config?.modelSettings?.metadata,
        },
      },
    ];
  }

  private buildRoutingConfig(config: any): ModelRoutingOptions | undefined {
    if (!config?.modelRouting) {
      return undefined;
    }

    const routing = config.modelRouting;
    return {
      mode: routing.mode,
      onError: routing.onError,
      concurrency: routing.concurrency,
      preferredOrder: routing.preferredOrder,
    };
  }

  private selectPrimaryResult(results: ModelExecutionResult[]): ModelExecutionResult | undefined {
    if (!results || results.length === 0) {
      return undefined;
    }

    const successful = results.filter((result) => result.success && !!result.outputText);
    if (successful.length > 0) {
      return successful[0];
    }

    return undefined;
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

  private buildSampleInput(
    inputVariables: WorkflowVariable[],
    overrides: Record<string, any> = {}
  ): { sample: Record<string, any>; warnings: string[] } {
    const sample: Record<string, any> = { ...overrides };
    const warnings: string[] = [];

    for (const variable of inputVariables) {
      if (sample[variable.name] !== undefined) {
        continue;
      }

      const defaultValue = this.parseJsonField(variable.defaultValue);

      if (defaultValue !== undefined) {
        sample[variable.name] = defaultValue;
        continue;
      }

      sample[variable.name] = this.generatePlaceholderValue(variable.dataType, variable.name);
      warnings.push(`Generated placeholder value for input '${variable.name}'.`);
    }

    return { sample, warnings };
  }

  private parseJsonField(value: any): any {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  private generatePlaceholderValue(dataType: string, variableName: string): any {
    switch (dataType) {
      case 'number':
        return 1;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return { example: `${variableName}Value` };
      default:
        return `Sample ${variableName}`;
    }
  }

  private normalizePreviewOutput(value: any): Record<string, any> | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return { items: this.cloneData(value) };
      }
      return this.cloneData(value);
    }

    return { value };
  }

  private parsePromptVariables(raw: unknown): Array<Record<string, any>> {
    if (!raw) {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw as Array<Record<string, any>>;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) {
        return [];
      }

      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? (parsed as Array<Record<string, any>>) : [];
      } catch {
        return [];
      }
    }
    // Support objects like { items: [...] } or { variables: [...] }
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, any>;
      const items = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.variables) ? obj.variables : null;
      if (Array.isArray(items)) {
        return items as Array<Record<string, any>>;
      }
    }

    return [];
  }

  private cloneData<T>(value: T): T {
    try {
      if (typeof (globalThis as any).structuredClone === 'function') {
        return (globalThis as any).structuredClone(value);
      }
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
}

export const workflowService = new WorkflowService();