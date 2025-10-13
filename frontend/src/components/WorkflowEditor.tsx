import { useState, useEffect, useCallback, useMemo, useContext, type ReactNode } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { promptsAPI, workflowsAPI } from '../services/api';
import type { Prompt } from '../types';
import { AuthContext } from '../contexts/AuthContext';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import LinearBuilderV2 from './LinearBuilderV2';

type PromptModelProvider = 'openai' | 'azure' | 'anthropic' | 'google' | 'custom';

const MODEL_PROVIDER_OPTIONS: Array<{ value: PromptModelProvider; label: string; defaultModel: string }> = [
  { value: 'openai', label: 'OpenAI · GPT', defaultModel: 'gpt-4o-mini' },
  { value: 'azure', label: 'Azure OpenAI · Responses', defaultModel: 'gpt-4o-mini' },
  { value: 'anthropic', label: 'Anthropic · Claude', defaultModel: 'claude-3-haiku-20240307' },
  { value: 'google', label: 'Google · Gemini', defaultModel: 'gemini-2.0-flash' },
  { value: 'custom', label: 'Custom Provider', defaultModel: 'custom-model' },
];

const DEFAULT_MODEL_PARAMETERS: PromptModelParameters = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 1024,
  parallelToolCalls: true,
};

interface FieldLabelProps {
  children: ReactNode;
  tooltip?: string;
  className?: string;
}

const FieldLabel = ({ children, tooltip, className }: FieldLabelProps) => (
  <label
    className={`block text-xs font-medium text-gray-700 mb-1 ${className ?? ''}`}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {tooltip ? (
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600"
          title={tooltip}
          aria-label={typeof children === 'string' ? `${children} info` : 'Field information'}
          role="note"
        >
          ?
        </span>
      ) : null}
    </span>
  </label>
);

const generateModelId = () => {
  if (typeof window !== 'undefined' && window.crypto && 'randomUUID' in window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `model-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

interface PromptModelRetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

interface PromptModelParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  parallelToolCalls?: boolean;
}

interface PromptModelConfig {
  id?: string;
  provider: PromptModelProvider;
  model: string;
  label?: string;
  disabled?: boolean;
  parameters?: PromptModelParameters;
  retry?: PromptModelRetryConfig;
}

interface PromptModelRoutingConfig {
  mode?: 'parallel' | 'fallback';
  onError?: 'abort' | 'continue';
  concurrency?: number;
  preferredOrder?: string[];
}

interface WorkflowStep {
  id?: string;
  name: string;
  type: 'PROMPT' | 'CONDITION' | 'TRANSFORM' | 'DELAY' | 'WEBHOOK' | 'DECISION';
  order: number;
  config: {
    description?: string;
    // PROMPT step configuration
    promptContent?: string;
    variables?: Record<string, string | number | boolean>;
    modelSettings?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      topP?: number;
      parallelToolCalls?: boolean;
      provider?: PromptModelProvider;
    };
    models?: PromptModelConfig[];
    modelRouting?: PromptModelRoutingConfig;
    // CONDITION step configuration
    condition?: {
      field?: string;
      operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
      value?: string | number | boolean;
      trueStepId?: string;
      falseStepId?: string;
    };
    // TRANSFORM step configuration
    transform?: {
      inputField?: string;
      outputField?: string;
      operation?: 'extract' | 'format' | 'convert' | 'calculate' | 'merge';
      parameters?: Record<string, string | number | boolean>;
      script?: string;
    };
    // DELAY step configuration
    delay?: {
      duration?: number;
      unit?: 'seconds' | 'minutes' | 'hours';
      reason?: string;
    };
    // WEBHOOK step configuration
    webhook?: {
      url?: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: Record<string, string | number | boolean>;
      timeout?: number;
      retries?: number;
    };
    // DECISION step configuration
    decision?: {
      criteria?: Array<{
        field: string;
        operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
        value: string | number | boolean;
        weight?: number;
      }>;
      defaultChoice?: string;
      choices?: Record<string, string>;
    };
  };
  promptId?: string;
  // Optional wiring for chaining
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
}

interface Workflow {
  id?: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  isActive: boolean;
}

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);
  const auth = useContext(AuthContext);
  const { isEnabled } = useFeatureFlags();
  const builderV2Enabled = isEnabled('builder.v2.linear');
  const [useBuilderV2, setUseBuilderV2] = useState(false);
  const fallbackUserId = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem('user');
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as { id?: string };
      return typeof parsed.id === 'string' ? parsed.id : null;
    } catch {
      return null;
    }
  }, []);
  const currentUserId = auth?.user?.id ?? fallbackUserId;
  
  const [workflow, setWorkflow] = useState<Workflow>({
    name: '',
    description: '',
    steps: [],
    isActive: true
  });
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availablePrompts, setAvailablePrompts] = useState<Prompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [modalStepName, setModalStepName] = useState('');
  const [modalStepType, setModalStepType] = useState<WorkflowStep['type']>('PROMPT');

  const groupedPrompts = useMemo(() => {
    const groups: Record<'owned' | 'shared' | 'public', Prompt[]> = {
      owned: [],
      shared: [],
      public: [],
    };

    const resolveScope = (prompt: Prompt): 'owned' | 'shared' | 'public' => {
      if (prompt.accessScope) {
        return prompt.accessScope;
      }

      if (currentUserId && prompt.user.id === currentUserId) {
        return 'owned';
      }

      return 'public';
    };

    availablePrompts.forEach((prompt) => {
      const scope = resolveScope(prompt);
      groups[scope].push(prompt);
    });

    return groups;
  }, [availablePrompts, currentUserId]);

  const firstAvailablePromptId = useMemo(() => {
    return (
      groupedPrompts.owned[0]?.id ||
      groupedPrompts.shared[0]?.id ||
      groupedPrompts.public[0]?.id ||
      null
    );
  }, [groupedPrompts]);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoadingPrompts(true);
      const response = await promptsAPI.getPrompts({ limit: 100 }); // Get more prompts for selection
      setAvailablePrompts(response.prompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  const fetchWorkflow = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const data = await workflowsAPI.getWorkflow(id);
      const parseMaybe = (v: unknown): Record<string, unknown> | undefined => {
        if (!v) return undefined;
        if (typeof v === 'string') {
          try { return JSON.parse(v) as Record<string, unknown>; } catch { return undefined; }
        }
        if (typeof v === 'object') return v as Record<string, unknown>;
        return undefined;
      };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedSteps = (data.steps || []).map((step: WorkflowStep & Record<string, any>) => {
        if (step.type !== 'PROMPT') {
          return {
            ...step,
            inputs: parseMaybe(step.inputs) ?? step.inputs,
            outputs: parseMaybe(step.outputs) ?? step.outputs,
            conditions: parseMaybe(step.conditions) ?? step.conditions,
          } as WorkflowStep;
        }

        const existingModels = Array.isArray(step.config?.models) ? step.config.models : undefined;
        const hydratedModels = (existingModels && existingModels.length > 0)
          ? existingModels.map((model, modelIndex) => ({
              ...model,
              id: model.id || `${step.id || 'step'}-model-${modelIndex}`,
              parameters: {
                ...DEFAULT_MODEL_PARAMETERS,
                ...model.parameters,
              },
            }))
          : [
              {
                id: generateModelId(),
                provider: 'openai',
                model: step.config?.modelSettings?.model || MODEL_PROVIDER_OPTIONS[0].defaultModel,
                parameters: {
                  temperature: step.config?.modelSettings?.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature,
                  maxTokens: step.config?.modelSettings?.maxTokens ?? DEFAULT_MODEL_PARAMETERS.maxTokens,
                  topP: step.config?.modelSettings?.topP ?? DEFAULT_MODEL_PARAMETERS.topP,
                  parallelToolCalls: step.config?.modelSettings?.parallelToolCalls ?? DEFAULT_MODEL_PARAMETERS.parallelToolCalls,
                },
                retry: {
                  maxAttempts: 2,
                  baseDelayMs: 750,
                  maxDelayMs: 5000,
                },
              },
            ];

        const preferredOrder = step.config?.modelRouting?.preferredOrder && step.config.modelRouting.preferredOrder.length > 0
          ? step.config.modelRouting.preferredOrder
          : hydratedModels.map((model) => model.id!).filter(Boolean);

        return {
          ...step,
          config: {
            ...step.config,
            models: hydratedModels,
            modelRouting: {
              mode: step.config?.modelRouting?.mode ?? 'parallel',
              onError: step.config?.modelRouting?.onError ?? 'continue',
              concurrency: step.config?.modelRouting?.concurrency,
              preferredOrder,
            },
          },
          inputs: parseMaybe(step.inputs) ?? step.inputs,
          outputs: parseMaybe(step.outputs) ?? step.outputs,
          conditions: parseMaybe(step.conditions) ?? step.conditions,
        };
      });

      setWorkflow({
        id: data.id,
        name: data.name,
        description: data.description || '',
        steps: normalizedSteps,
        isActive: data.isActive
      });
    } catch (err) {
      console.error('Error fetching workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflow';
      setError(errorMessage);
      
      // If authentication error, redirect to login
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEditing) {
      fetchWorkflow();
    }
    fetchPrompts();
    // Open Add Step modal if requested via query param
    const params = new URLSearchParams(location.search);
    if (params.get('openAddStep') === '1') {
      setShowAddStepModal(true);
    }
    // Auto-enable Builder V2 if requested via query param
    if (builderV2Enabled && params.get('v2') === '1') {
      setUseBuilderV2(true);
    }
  }, [id, isEditing, fetchWorkflow, fetchPrompts, location.search, builderV2Enabled]);

  const validateWorkflowSteps = () => {
    const errors: string[] = [];
    
    workflow.steps.forEach((step, index) => {
      if (step.type === 'PROMPT') {
        // Check if step has either a selected prompt or inline content
        const hasPromptId = !!step.promptId;
        const hasInlineContent = !!(step.config.promptContent?.trim());
        
        if (!hasPromptId && !hasInlineContent) {
          errors.push(`Step ${index + 1} (${step.name}): Please select an existing prompt or create inline prompt content`);
        }
      }
    });
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflow.name.trim()) {
      setError('Workflow name is required');
      return;
    }

    // Validate workflow steps
    const validationErrors = validateWorkflowSteps();
    if (validationErrors.length > 0) {
      setError(`Please fix the following issues:\n• ${validationErrors.join('\n• ')}`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const workflowData = {
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.isActive
      };

      const savedWorkflow = isEditing 
        ? await workflowsAPI.updateWorkflow(id!, workflowData)
        : await workflowsAPI.createWorkflow(workflowData);

      // For new workflows, we now have the ID and can save any pending steps
      if (!isEditing && workflow.steps.length > 0) {
        const workflowId = savedWorkflow.id;
        
        for (const step of workflow.steps) {
          try {
            await saveStepToBackend(workflowId, step);
          } catch (stepError) {
            console.error('Failed to save step:', step.name, stepError);
            // Continue with other steps rather than failing completely
          }
        }
      }

      navigate('/workflows');
    } catch (err: unknown) {
      console.error('Error saving workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save workflow';
      setError(errorMessage);
      
      // If authentication error, redirect to login
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    } finally {
      setSaving(false);
    }
  };

  const saveStepToBackend = async (workflowId: string, step: WorkflowStep) => {
    try {
      const savedStep = await workflowsAPI.createStep(workflowId, {
        name: step.name,
        type: step.type,
        order: step.order,
        config: step.config,
        promptId: step.promptId,
        inputs: step.inputs,
        outputs: step.outputs,
        conditions: step.conditions,
      });
      return savedStep;
    } catch (error) {
      console.error('Failed to save step to backend:', error);
      throw error;
    }
  };

  const addStep = async () => {
    const newStep: WorkflowStep = {
      name: modalStepName?.trim() || `Step ${workflow.steps.length + 1}`,
      type: modalStepType || 'PROMPT',
      order: workflow.steps.length + 1,
      config: {
        description: ''
      }
    };

    if (newStep.type === 'PROMPT') {
      const openAIOption = MODEL_PROVIDER_OPTIONS.find((option) => option.value === 'openai');
      newStep.config.models = [
        {
          id: generateModelId(),
          provider: openAIOption?.value ?? 'openai',
          model: openAIOption?.defaultModel ?? 'gpt-4o-mini',
          parameters: { ...DEFAULT_MODEL_PARAMETERS },
          retry: {
            maxAttempts: 2,
            baseDelayMs: 750,
            maxDelayMs: 5000,
          },
        },
      ];
      newStep.config.modelRouting = {
        mode: 'parallel',
        onError: 'continue',
        preferredOrder: newStep.config.models.map((model) => model.id!).filter(Boolean),
      };
    }
    
    // For existing workflows, save the step immediately to the backend
    if (isEditing && id) {
      try {
        setSavingStep(true);
        setError(null);
        const savedStep = await saveStepToBackend(id, newStep);
        // Update local state with the step that includes the backend-generated ID
        setWorkflow(prev => ({
          ...prev,
          steps: [...prev.steps, { ...newStep, id: savedStep.id }]
        }));
      } catch (error) {
        console.error('Failed to save new step:', error);
        setError('Failed to add step. Please try again.');
        return;
      } finally {
        setSavingStep(false);
      }
    } else {
      // For new workflows, just add to local state (will be saved when workflow is saved)
      setWorkflow(prev => ({
        ...prev,
        steps: [...prev.steps, newStep]
      }));
    }
    // Close modal and clear param
    setShowAddStepModal(false);
    setModalStepName('');
    setModalStepType('PROMPT');
    const params = new URLSearchParams(location.search);
    if (params.get('openAddStep') === '1') {
      params.delete('openAddStep');
      navigate({ search: params.toString() }, { replace: true });
    }
  };

  const removeStep = (index: number) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({
        ...step,
        order: i + 1
      }))
    }));
  };

  const updateStep = async (index: number, updates: Partial<WorkflowStep>) => {
    const step = workflow.steps[index];
    
    // Update local state first for immediate UI feedback
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, ...updates } : step
      )
    }));

    // For existing workflows with saved steps, persist changes to backend
    if (isEditing && id && step.id) {
      try {
        const updatedStep = { ...step, ...updates };
        await workflowsAPI.updateStep(id, step.id, {
          name: updatedStep.name,
          type: updatedStep.type,
          order: updatedStep.order,
          config: updatedStep.config,
          promptId: updatedStep.promptId,
          inputs: updatedStep.inputs,
          outputs: updatedStep.outputs,
          conditions: updatedStep.conditions,
        });
      } catch (error) {
        console.error('Failed to save step update:', error);
        // Optionally show user feedback about the error
        setError('Failed to save step changes. Please try again.');
      }
    }
  };

  const hydrateModelConfig = (model: PromptModelConfig): PromptModelConfig => ({
    ...model,
    id: model.id || generateModelId(),
    parameters: {
      ...DEFAULT_MODEL_PARAMETERS,
      ...model.parameters,
    },
    retry: {
      maxAttempts: model.retry?.maxAttempts ?? 2,
      baseDelayMs: model.retry?.baseDelayMs ?? 750,
      maxDelayMs: model.retry?.maxDelayMs ?? 5000,
    },
  });

  const reconcilePreferredOrder = (order: string[] | undefined, models: PromptModelConfig[]): string[] => {
    const modelIds = models.map((model) => model.id!).filter(Boolean);
    const baseOrder = (order || []).filter((id) => modelIds.includes(id));
    const missing = modelIds.filter((id) => !baseOrder.includes(id));
    return [...baseOrder, ...missing];
  };

  const updatePromptStepModels = (
    stepIndex: number,
    transformer: (models: PromptModelConfig[]) => PromptModelConfig[],
  ) => {
    const step = workflow.steps[stepIndex];
    if (!step || step.type !== 'PROMPT') {
      return;
    }

    const currentModels = Array.isArray(step.config.models) ? step.config.models : [];
    const transformed = transformer(currentModels).map(hydrateModelConfig);
    if (transformed.length === 0) {
      return;
    }

    const routing = step.config.modelRouting ?? {
      mode: 'parallel',
      onError: 'continue',
    };

    const preferredOrder = transformed.map((model) => model.id!).filter(Boolean);

    updateStep(stepIndex, {
      config: {
        ...step.config,
        models: transformed,
        modelRouting: {
          ...routing,
          preferredOrder,
        },
      },
    });
  };

  const updatePromptStepRouting = (
    stepIndex: number,
    updates: Partial<PromptModelRoutingConfig>,
  ) => {
    const step = workflow.steps[stepIndex];
    if (!step || step.type !== 'PROMPT') {
      return;
    }

    const currentModels = Array.isArray(step.config.models) ? step.config.models.map(hydrateModelConfig) : [];
    if (currentModels.length === 0) {
      return;
    }

    const routing = step.config.modelRouting ?? {
      mode: 'parallel',
      onError: 'continue',
    };

    const nextRouting = {
      ...routing,
      ...updates,
    };

    nextRouting.preferredOrder = reconcilePreferredOrder(nextRouting.preferredOrder, currentModels);

    updateStep(stepIndex, {
      config: {
        ...step.config,
        models: currentModels,
        modelRouting: nextRouting,
      },
    });
  };

  const addModelToStep = (stepIndex: number) => {
    const providerOption = MODEL_PROVIDER_OPTIONS[0];
    updatePromptStepModels(stepIndex, (models) => [
      ...models,
      {
        id: generateModelId(),
      provider: providerOption.value,
      model: providerOption.defaultModel,
        parameters: { ...DEFAULT_MODEL_PARAMETERS },
        retry: {
          maxAttempts: 2,
          baseDelayMs: 750,
          maxDelayMs: 5000,
        },
      },
    ]);
  };

  const removeModelFromStep = (stepIndex: number, modelId: string) => {
    updatePromptStepModels(stepIndex, (models) => {
      if (models.length <= 1) {
        return models;
      }
      return models.filter((model) => model.id !== modelId);
    });
  };

  const moveModelInStep = (stepIndex: number, modelId: string, direction: 'up' | 'down') => {
    updatePromptStepModels(stepIndex, (models) => {
      const currentIndex = models.findIndex((model) => model.id === modelId);
      if (currentIndex === -1) {
        return models;
      }

      const targetIndex = direction === 'up'
        ? Math.max(0, currentIndex - 1)
        : Math.min(models.length - 1, currentIndex + 1);

      if (currentIndex === targetIndex) {
        return models;
      }

      const reordered = [...models];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
  };

  const updateModelConfig = (
    stepIndex: number,
    modelId: string,
    updates: Partial<PromptModelConfig>,
  ) => {
    updatePromptStepModels(stepIndex, (models) =>
      models.map((model) =>
        model.id === modelId
          ? {
              ...model,
              ...updates,
            }
          : model,
      ),
    );
  };

  const updateModelParameters = (
    stepIndex: number,
    modelId: string,
    parameterUpdates: Partial<PromptModelConfig['parameters']>,
  ) => {
    updatePromptStepModels(stepIndex, (models) =>
      models.map((model) =>
        model.id === modelId
          ? {
              ...model,
              parameters: {
                ...DEFAULT_MODEL_PARAMETERS,
                ...model.parameters,
                ...parameterUpdates,
              },
            }
          : model,
      ),
    );
  };

  const updateModelRetry = (
    stepIndex: number,
    modelId: string,
    retryUpdates: Partial<PromptModelConfig['retry']>,
  ) => {
    updatePromptStepModels(stepIndex, (models) =>
      models.map((model) =>
        model.id === modelId
          ? {
              ...model,
              retry: {
                maxAttempts: model.retry?.maxAttempts ?? 2,
                baseDelayMs: model.retry?.baseDelayMs ?? 750,
                maxDelayMs: model.retry?.maxDelayMs ?? 5000,
                ...retryUpdates,
              },
            }
          : model,
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Feature-flagged Linear Builder V2 early render path
  if (builderV2Enabled && useBuilderV2) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditing ? 'Edit Workflow' : 'Create New Workflow'}
              </h1>
              <p className="mt-2 text-gray-600">Design automated workflows to chain prompts together</p>
            </div>
            <Link
              to="/workflows"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Workflows
            </Link>
          </div>
        </div>

        {builderV2Enabled && (
          <div className="mb-4">
            <button
              type="button"
              className="px-3 py-1 border rounded"
              data-testid="builder-v2-toggle"
              onClick={() => setUseBuilderV2((v) => !v)}
            >
              {useBuilderV2 ? 'Switch to Builder V1' : 'Switch to Builder V2'}
            </button>
          </div>
        )}

        <LinearBuilderV2 workflowId={typeof id === 'string' ? id : undefined} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing ? 'Edit Workflow' : 'Create New Workflow'}
            </h1>
            <p className="mt-2 text-gray-600">
              Design automated workflows to chain prompts together
            </p>
          </div>
          <Link
            to="/workflows"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Back to Workflows
          </Link>
        </div>
      </div>

      {builderV2Enabled && (
        <div className="mb-4">
          <button
            type="button"
            className="px-3 py-1 border rounded"
            data-testid="builder-v2-toggle"
            onClick={() => setUseBuilderV2((v) => !v)}
          >
            {useBuilderV2 ? 'Switch to Builder V1' : 'Switch to Builder V2'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Workflow Name *
              </label>
              <input
                type="text"
                id="name"
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                placeholder="My Workflow"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={workflow.description}
                onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                placeholder="Describe what this workflow does..."
              />
            </div>

            <div className="flex items-center">
              <input
                id="isActive"
                type="checkbox"
                checked={workflow.isActive}
                onChange={(e) => setWorkflow(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active workflow (can be executed)
              </label>
            </div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Workflow Steps</h2>
            <button
              type="button"
              onClick={addStep}
              disabled={savingStep}
              data-testid="add-step-button"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingStep ? 'Adding...' : 'Add Step'}
            </button>
          </div>

          {workflow.steps.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="text-sm font-medium text-gray-900">No steps yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add your first workflow step to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {workflow.steps.map((step, index) => (
                <div key={index} data-testid={`workflow-step-${index}`} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Step {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      data-testid={`remove-step-${index}`}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Step Name
                      </label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(index, { name: e.target.value })}
                        data-testid={`step-name-${index}`}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Step Type
                      </label>
                      <select
                        value={step.type}
                        onChange={(e) => updateStep(index, { type: e.target.value as WorkflowStep['type'] })}
                        data-testid={`step-type-${index}`}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="PROMPT">Prompt</option>
                        <option value="CONDITION">Condition</option>
                        <option value="TRANSFORM">Transform</option>
                        <option value="DELAY">Delay</option>
                        <option value="WEBHOOK">Webhook</option>
                        <option value="DECISION">Decision</option>
                      </select>
                    </div>
                  </div>

                  {/* Description field (common to all types) */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={step.config.description || ''}
                      onChange={(e) => updateStep(index, { 
                        config: { ...step.config, description: e.target.value }
                      })}
                      rows={2}
                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Describe what this step does..."
                    />
                  </div>

                  {/* Type-specific configuration */}
                  {step.type === 'PROMPT' && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900">Prompt Configuration</h4>
                      
                      {/* Option to select existing prompt or create inline */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Prompt Source
                        </label>
                        <div className="flex items-center space-x-4 mb-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`promptSource-${index}`}
                              value="existing"
                              checked={!!step.promptId}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateStep(index, { 
                                    promptId: firstAvailablePromptId ?? undefined,
                                    config: { ...step.config, promptContent: undefined }
                                  });
                                }
                              }}
                              className="mr-2"
                            />
                            Use existing prompt
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`promptSource-${index}`}
                              value="inline"
                              checked={!step.promptId}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateStep(index, { 
                                    promptId: undefined,
                                    config: { ...step.config, promptContent: '' }
                                  });
                                }
                              }}
                              className="mr-2"
                            />
                            Create inline prompt
                          </label>
                        </div>
                      </div>

                      {/* Existing prompt selection */}
                      {step.promptId !== undefined && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Select Prompt
                          </label>
                          <select
                            value={step.promptId || ''}
                            onChange={(e) => updateStep(index, { promptId: e.target.value })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            disabled={loadingPrompts}
                          >
                            <option value="">Select a prompt...</option>
                            {groupedPrompts.owned.length > 0 && (
                              <optgroup label="My prompts">
                                {groupedPrompts.owned.map((prompt) => (
                                  <option key={prompt.id} value={prompt.id}>
                                    {prompt.name} {prompt.folder ? `(${prompt.folder.name})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {groupedPrompts.shared.length > 0 && (
                              <optgroup label="Shared with me">
                                {groupedPrompts.shared.map((prompt) => {
                                  const ownerLabel = prompt.user.name || prompt.user.email;
                                  const folderLabel = prompt.folder ? `(${prompt.folder.name})` : '';
                                  return (
                                    <option key={prompt.id} value={prompt.id}>
                                      {prompt.name} {folderLabel} • {ownerLabel}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                            {groupedPrompts.public.length > 0 && (
                              <optgroup label="Public">
                                {groupedPrompts.public.map((prompt) => {
                                  const ownerLabel = prompt.user.name || prompt.user.email;
                                  const folderLabel = prompt.folder ? `(${prompt.folder.name})` : '';
                                  return (
                                    <option key={prompt.id} value={prompt.id}>
                                      {prompt.name} {folderLabel} • Public by {ownerLabel}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                          </select>
                          {loadingPrompts && (
                            <p className="text-xs text-gray-500 mt-1">Loading prompts...</p>
                          )}
                          {step.promptId && !loadingPrompts && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <p className="font-medium">Selected Prompt Preview:</p>
                              {(() => {
                                const selectedPrompt = availablePrompts.find((p) => p.id === step.promptId);
                                if (!selectedPrompt) {
                                  return <p className="text-gray-500">Prompt not found</p>;
                                }

                                const ownerLabel = selectedPrompt.user.name || selectedPrompt.user.email;

                                return (
                                  <div className="mt-1 space-y-2">
                                    <p className="text-gray-600 truncate">{selectedPrompt.content}</p>
                                    {selectedPrompt.accessScope === 'shared' && (
                                      <p className="text-xs font-medium text-indigo-600">
                                        Shared library • Owner: {ownerLabel}
                                      </p>
                                    )}
                                    {selectedPrompt.accessScope === 'public' && (
                                      <p className="text-xs text-gray-500">Public prompt by {ownerLabel}</p>
                                    )}
                                    {selectedPrompt.variables.length > 0 && (
                                      <p className="text-gray-500 text-xs">
                                        Variables: {selectedPrompt.variables.map((v) => `{{${v.name}}}`).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inline prompt creation */}
                      {!step.promptId && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Prompt Content
                          </label>
                          <textarea
                            value={step.config.promptContent || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, promptContent: e.target.value }
                            })}
                            rows={4}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Enter your prompt text here..."
                          />
                        </div>
                      )}

                      {/* Ensemble model configuration */}
                      <div className="border-t pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium text-gray-900">Model Ensemble</h5>
                          <button
                            type="button"
                            onClick={() => addModelToStep(index)}
                            className="text-xs font-medium text-purple-700 hover:text-purple-900"
                          >
                            + Add model
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">
                          Configure one or more models to execute for this prompt. Use fallback mode to try providers in order, or run in parallel.
                        </p>

                        <div className="space-y-3">
                          {(step.config.models || []).map((model, modelIdx) => {
                            const providerOption = MODEL_PROVIDER_OPTIONS.find((option) => option.value === model.provider);
                            const providerLabel = providerOption?.label || 'Provider';
                            const modelsCount = step.config.models?.length || 0;

                            return (
                              <div key={model.id || modelIdx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
                                      <select
                                        value={model.provider}
                                        onChange={(e) => {
                                          const nextProvider = e.target.value as PromptModelProvider;
                                          const nextDefaultModel = MODEL_PROVIDER_OPTIONS.find((option) => option.value === nextProvider)?.defaultModel || model.model;
                                          updateModelConfig(index, model.id!, {
                                            provider: nextProvider,
                                            model: nextDefaultModel,
                                          });
                                        }}
                                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                      >
                                        {MODEL_PROVIDER_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Model name</label>
                                      <input
                                        type="text"
                                        value={model.model}
                                        onChange={(e) => updateModelConfig(index, model.id!, { model: e.target.value })}
                                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                        placeholder={providerOption?.defaultModel || 'model-id'}
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Display label</label>
                                      <input
                                        type="text"
                                        value={model.label || ''}
                                        onChange={(e) => updateModelConfig(index, model.id!, { label: e.target.value })}
                                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                        placeholder={`${providerLabel} output`}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2 md:flex-col md:items-end">
                                    <button
                                      type="button"
                                      onClick={() => moveModelInStep(index, model.id!, 'up')}
                                      disabled={modelIdx === 0}
                                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
                                    >
                                      ↑ Move up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveModelInStep(index, model.id!, 'down')}
                                      disabled={modelIdx === modelsCount - 1}
                                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
                                    >
                                      ↓ Move down
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeModelFromStep(index, model.id!)}
                                      disabled={modelsCount <= 1}
                                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-40"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <FieldLabel tooltip="Controls randomness in generation. Lower values (~0) make outputs more deterministic; higher values (~1-2) produce more varied results.">Temperature</FieldLabel>
                                    <input
                                      type="number"
                                      min="0"
                                      max="2"
                                      step="0.05"
                                      value={model.parameters?.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature}
                                      onChange={(e) => {
                                        const next = parseFloat(e.target.value);
                                        updateModelParameters(index, model.id!, {
                                          temperature: Number.isFinite(next) ? next : undefined,
                                        });
                                      }}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <FieldLabel tooltip="Applies nucleus sampling. Lower values restrict choices to the most probable tokens; higher values allow broader vocabulary.">Top P</FieldLabel>
                                    <input
                                      type="number"
                                      min="0"
                                      max="1"
                                      step="0.05"
                                      value={model.parameters?.topP ?? DEFAULT_MODEL_PARAMETERS.topP}
                                      onChange={(e) => {
                                        const next = parseFloat(e.target.value);
                                        updateModelParameters(index, model.id!, {
                                          topP: Number.isFinite(next) ? next : undefined,
                                        });
                                      }}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <FieldLabel tooltip="Sets the maximum length of the model response. Higher limits allow longer outputs but consume more tokens and may take longer.">Max tokens</FieldLabel>
                                    <input
                                      type="number"
                                      min="1"
                                      max="4000"
                                      value={model.parameters?.maxTokens ?? DEFAULT_MODEL_PARAMETERS.maxTokens}
                                      onChange={(e) => {
                                        const next = parseInt(e.target.value, 10);
                                        updateModelParameters(index, model.id!, {
                                          maxTokens: Number.isFinite(next) ? next : undefined,
                                        });
                                      }}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    />
                                  </div>
                                </div>

                                {['openai', 'azure'].includes(model.provider) && (
                                  <div className="md:col-span-3">
                                    <FieldLabel tooltip="For providers that support tool/function calls, enabling this lets them execute helper calls concurrently for faster responses.">Parallel tool calls</FieldLabel>
                                    <label className="flex items-center gap-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={model.parameters?.parallelToolCalls ?? true}
                                        onChange={(e) =>
                                          updateModelParameters(index, model.id!, {
                                            parallelToolCalls: e.target.checked,
                                          })
                                        }
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                      />
                                      Allow provider tool calls to run concurrently (OpenAI & Azure Responses)
                                    </label>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <FieldLabel tooltip="Maximum number of times to retry when the provider returns transient errors (e.g., rate limits or timeouts).">Retry attempts</FieldLabel>
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={model.retry?.maxAttempts ?? 2}
                                      onChange={(e) => {
                                        const next = parseInt(e.target.value, 10);
                                        updateModelRetry(index, model.id!, {
                                          maxAttempts: Number.isFinite(next) ? next : undefined,
                                        });
                                      }}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <FieldLabel tooltip="Initial wait time before the first retry in milliseconds. Subsequent retries increase exponentially from this base value.">Base delay (ms)</FieldLabel>
                                    <input
                                      type="number"
                                      min="100"
                                      step="50"
                                      value={model.retry?.baseDelayMs ?? 750}
                                      onChange={(e) => {
                                        const next = parseInt(e.target.value, 10);
                                        updateModelRetry(index, model.id!, {
                                          baseDelayMs: Number.isFinite(next) ? next : undefined,
                                        });
                                      }}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <FieldLabel tooltip="Caps the exponential backoff between retries so delays never exceed this value.">Max delay (ms)</FieldLabel>
                                    <input
                                      type="number"
                                      min="100"
                                      step="50"
                                      value={model.retry?.maxDelayMs ?? 5000}
                                      onChange={(e) => {
                                        const next = parseInt(e.target.value, 10);
                                        updateModelRetry(index, model.id!, {
                                          maxDelayMs: Number.isFinite(next) ? next : undefined,
                                        });
                                      }}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <label className="flex items-center text-xs text-gray-600">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(model.disabled)}
                                      onChange={(e) => updateModelConfig(index, model.id!, { disabled: e.target.checked })}
                                      className="mr-2"
                                    />
                                    Disable this model during execution
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="border-t pt-4 space-y-3">
                          <h6 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Routing Strategy</h6>
                          <div className="flex flex-wrap gap-4 text-xs text-gray-700">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`modelRoutingMode-${index}`}
                                value="parallel"
                                checked={(step.config.modelRouting?.mode || 'parallel') === 'parallel'}
                                onChange={() => updatePromptStepRouting(index, { mode: 'parallel' })}
                              />
                              Run all models in parallel
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`modelRoutingMode-${index}`}
                                value="fallback"
                                checked={step.config.modelRouting?.mode === 'fallback'}
                                onChange={() => updatePromptStepRouting(index, { mode: 'fallback' })}
                              />
                              Fallback through models in order
                            </label>
                          </div>

                          {(step.config.modelRouting?.mode || 'parallel') === 'parallel' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <FieldLabel tooltip="How many models can execute at the same time in parallel mode. Lower values queue extra models until slots free up.">Parallelism limit</FieldLabel>
                                <input
                                  type="number"
                                  min="1"
                                  max={(step.config.models || []).length || 1}
                                  value={step.config.modelRouting?.concurrency || (step.config.models || []).length || 1}
                                  onChange={(e) => {
                                    const next = parseInt(e.target.value, 10);
                                    updatePromptStepRouting(index, {
                                      concurrency: Number.isFinite(next) ? next : undefined,
                                    });
                                  }}
                                  className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Limit how many models run at once (default runs all concurrently).
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-500">
                              Models will run one at a time in the order shown above. Move cards to rearrange fallback priority.
                            </div>
                          )}

                          <div>
                            <FieldLabel tooltip="Choose whether to keep responses from successful models when others fail (Continue) or abort the step immediately (Abort).">On error</FieldLabel>
                            <select
                              value={step.config.modelRouting?.onError || 'continue'}
                              onChange={(e) => updatePromptStepRouting(index, { onError: e.target.value as 'abort' | 'continue' })}
                              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value="continue">Continue with available responses</option>
                              <option value="abort">Abort the step if models fail</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Variable mapping section for existing prompts */}
                      {step.promptId && (() => {
                        const selectedPrompt = availablePrompts.find(p => p.id === step.promptId);
                        return selectedPrompt && selectedPrompt.variables.length > 0 ? (
                          <div className="border-t pt-4">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Variable Mapping</h5>
                            <p className="text-xs text-gray-600 mb-3">Map workflow variables to prompt variables:</p>
                            <div className="space-y-2">
                              {selectedPrompt.variables.map((variable) => (
                                <div key={variable.name} className="grid grid-cols-3 gap-2">
                                  <div className="text-xs text-gray-700 self-center">
                                    {variable.name} ({variable.type}){variable.required && '*'}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Enter value or {{workflow.variable}}"
                                    value={step.config.variables?.[variable.name] as string || ''}
                                    onChange={(e) => updateStep(index, {
                                      config: {
                                        ...step.config,
                                        variables: {
                                          ...step.config.variables,
                                          [variable.name]: e.target.value
                                        }
                                      }
                                    })}
                                    className="col-span-2 text-xs border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {step.type === 'CONDITION' && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900">Condition Configuration</h4>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Field to Check
                          </label>
                          <input
                            type="text"
                            value={step.config.condition?.field || ''}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                condition: { ...step.config.condition, field: e.target.value }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="output.confidence"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Operator
                          </label>
                          <select
                            value={step.config.condition?.operator || 'equals'}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                condition: { ...step.config.condition, operator: e.target.value as 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="equals">Equals</option>
                            <option value="contains">Contains</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                            <option value="exists">Exists</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Value
                          </label>
                          <input
                            type="text"
                            value={String(step.config.condition?.value || '')}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                condition: { ...step.config.condition, value: e.target.value }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0.8"
                          />
                        </div>
                      </div>

                      {/* Output aliasing for chaining */}
                      <div className="border-t pt-4 space-y-2">
                        <h5 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          Chaining: Export Outputs
                          <span className="text-[11px] font-normal text-gray-500">Map fields from this step’s output to variable names for the next steps (e.g., generatedText → facts)</span>
                        </h5>
                        <div className="rounded border border-gray-200 p-3 bg-gray-50">
                          <div className="text-xs text-gray-600 mb-2">Common fields: generatedText, model, tokensUsed, providerResults, modelOutputs</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <label className="text-xs font-medium text-gray-700">Alias name</label>
                            <label className="text-xs font-medium text-gray-700 md:col-span-2">Source path</label>
                          </div>
                          {Object.entries(step.outputs || {}).map(([alias, srcPath], rowIdx) => (
                            <div key={alias + rowIdx} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                              <input
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                value={alias}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const entries = Object.entries(step.outputs || {});
                                  const idx = entries.findIndex(([k]) => k === alias);
                                  if (idx >= 0) {
                                    entries[idx][0] = val || '';
                                    const next: Record<string, unknown> = {};
                                    entries.forEach(([k, v]) => { if (k) next[k] = v; });
                                    updateStep(index, { outputs: next });
                                  }
                                }}
                                placeholder="facts"
                              />
                              <input
                                className="md:col-span-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                value={typeof srcPath === 'string' ? srcPath : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const next = { ...(step.outputs || {}) } as Record<string, unknown>;
                                  next[alias] = val;
                                  updateStep(index, { outputs: next });
                                }}
                                placeholder="generatedText or modelOutputs.openai['gpt-4o-mini'].text"
                              />
                            </div>
                          ))}
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-purple-700 hover:text-purple-900"
                              onClick={() => {
                                const next = { ...(step.outputs || {}) } as Record<string, unknown>;
                                const base = 'alias'; let i = 1; let key = `${base}${i}`;
                                while (Object.prototype.hasOwnProperty.call(next, key)) { i += 1; key = `${base}${i}`; }
                                next[key] = 'generatedText';
                                updateStep(index, { outputs: next });
                              }}
                            >
                              + Add mapping
                            </button>
                            {step.outputs && Object.keys(step.outputs).length > 0 && (
                              <button
                                type="button"
                                className="text-xs text-gray-600 hover:text-gray-800"
                                onClick={() => updateStep(index, { outputs: {} })}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-2">Use {'{{alias}}'} in later prompt content. Example: Step 1 exports facts ← generatedText, then Step 2 prompt can include “Based on these facts: {'{{facts}}'} …”.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step.type === 'TRANSFORM' && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900">Transform Configuration</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Input Field
                          </label>
                          <input
                            type="text"
                            value={step.config.transform?.inputField || ''}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                transform: { ...step.config.transform, inputField: e.target.value }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="previousStep.output"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Output Field
                          </label>
                          <input
                            type="text"
                            value={step.config.transform?.outputField || ''}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                transform: { ...step.config.transform, outputField: e.target.value }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="transformedData"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Operation
                        </label>
                        <select
                          value={step.config.transform?.operation || 'extract'}
                          onChange={(e) => updateStep(index, {
                            config: {
                              ...step.config,
                              transform: { ...step.config.transform, operation: e.target.value as 'extract' | 'format' | 'convert' | 'calculate' | 'merge' }
                            }
                          })}
                          className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="extract">Extract</option>
                          <option value="format">Format</option>
                          <option value="convert">Convert</option>
                          <option value="calculate">Calculate</option>
                          <option value="merge">Merge</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Transformation Script
                        </label>
                        <textarea
                          value={step.config.transform?.script || ''}
                          onChange={(e) => updateStep(index, {
                            config: {
                              ...step.config,
                              transform: { ...step.config.transform, script: e.target.value }
                            }
                          })}
                          rows={3}
                          className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          placeholder="// JavaScript code to transform the input"
                        />
                      </div>
                    </div>
                  )}

                  {step.type === 'DELAY' && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900">Delay Configuration</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Duration
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={step.config.delay?.duration || 5}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                delay: { ...step.config.delay, duration: parseInt(e.target.value) }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Unit
                          </label>
                          <select
                            value={step.config.delay?.unit || 'seconds'}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                delay: { ...step.config.delay, unit: e.target.value as 'seconds' | 'minutes' | 'hours' }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="seconds">Seconds</option>
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Reason for Delay
                        </label>
                        <input
                          type="text"
                          value={step.config.delay?.reason || ''}
                          onChange={(e) => updateStep(index, {
                            config: {
                              ...step.config,
                              delay: { ...step.config.delay, reason: e.target.value }
                            }
                          })}
                          className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          placeholder="Wait for external system processing"
                        />
                      </div>
                    </div>
                  )}

                  {step.type === 'WEBHOOK' && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900">Webhook Configuration</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            URL
                          </label>
                          <input
                            type="url"
                            value={step.config.webhook?.url || ''}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                webhook: { ...step.config.webhook, url: e.target.value }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="https://api.example.com/webhook"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Method
                          </label>
                          <select
                            value={step.config.webhook?.method || 'POST'}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                webhook: { ...step.config.webhook, method: e.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE' }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Timeout (seconds)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="300"
                            value={step.config.webhook?.timeout || 30}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                webhook: { ...step.config.webhook, timeout: parseInt(e.target.value) }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Retries
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={step.config.webhook?.retries || 3}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                webhook: { ...step.config.webhook, retries: parseInt(e.target.value) }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {step.type === 'DECISION' && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900">Decision Configuration</h4>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Default Choice
                        </label>
                        <input
                          type="text"
                          value={step.config.decision?.defaultChoice || ''}
                          onChange={(e) => updateStep(index, {
                            config: {
                              ...step.config,
                              decision: { ...step.config.decision, defaultChoice: e.target.value }
                            }
                          })}
                          className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          placeholder="Default next step if no criteria match"
                        />
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">
                          Decision logic will be implemented in a future version
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Step Modal */}
        {showAddStepModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30" data-testid="add-step-modal">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Workflow Step</h3>
                <button
                  aria-label="Close"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowAddStepModal(false);
                    const params = new URLSearchParams(location.search);
                    if (params.get('openAddStep') === '1') {
                      params.delete('openAddStep');
                      navigate({ search: params.toString() }, { replace: true });
                    }
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="modal-step-name">Step Name</label>
                  <input
                    id="modal-step-name"
                    type="text"
                    value={modalStepName}
                    onChange={(e) => setModalStepName(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    placeholder={`Step ${workflow.steps.length + 1}`}
                    data-testid="modal-step-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="modal-step-type">Step Type</label>
                  <select
                    id="modal-step-type"
                    value={modalStepType}
                    onChange={(e) => setModalStepType(e.target.value as WorkflowStep['type'])}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    data-testid="modal-step-type"
                  >
                    <option value="PROMPT">Prompt</option>
                    <option value="CONDITION">Condition</option>
                    <option value="TRANSFORM">Transform</option>
                    <option value="DELAY">Delay</option>
                    <option value="WEBHOOK">Webhook</option>
                    <option value="DECISION">Decision</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => {
                      setShowAddStepModal(false);
                      const params = new URLSearchParams(location.search);
                      if (params.get('openAddStep') === '1') {
                        params.delete('openAddStep');
                        navigate({ search: params.toString() }, { replace: true });
                      }
                    }}
                    data-testid="modal-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-md text-white bg-purple-600 hover:bg-purple-700"
                    onClick={addStep}
                    disabled={savingStep}
                    data-testid="modal-add-step"
                  >
                    {savingStep ? 'Adding...' : 'Add Step'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4">
          <Link
            to="/workflows"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            data-testid="submit-workflow-button"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update Workflow' : 'Create Workflow')}
          </button>
        </div>
      </form>
    </div>
  );
}