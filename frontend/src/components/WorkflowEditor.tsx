import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { promptsAPI, workflowsAPI } from '../services/api';
import type { Prompt } from '../types';

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
    };
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
      setWorkflow({
        id: data.id,
        name: data.name,
        description: data.description || '',
        steps: data.steps || [],
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
  }, [id, isEditing, fetchWorkflow, fetchPrompts, location.search]);

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
        promptId: step.promptId
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
          promptId: updatedStep.promptId
        });
      } catch (error) {
        console.error('Failed to save step update:', error);
        // Optionally show user feedback about the error
        setError('Failed to save step changes. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
                                    promptId: availablePrompts[0]?.id,
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
                            {availablePrompts.map(prompt => (
                              <option key={prompt.id} value={prompt.id}>
                                {prompt.name} {prompt.folder ? `(${prompt.folder.name})` : ''}
                              </option>
                            ))}
                          </select>
                          {loadingPrompts && (
                            <p className="text-xs text-gray-500 mt-1">Loading prompts...</p>
                          )}
                          {step.promptId && !loadingPrompts && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <p className="font-medium">Selected Prompt Preview:</p>
                              {(() => {
                                const selectedPrompt = availablePrompts.find(p => p.id === step.promptId);
                                return selectedPrompt ? (
                                  <div className="mt-1">
                                    <p className="text-gray-600 truncate">{selectedPrompt.content}</p>
                                    {selectedPrompt.variables.length > 0 && (
                                      <p className="text-gray-500 text-xs mt-1">
                                        Variables: {selectedPrompt.variables.map(v => `{{${v.name}}}`).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-gray-500">Prompt not found</p>
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

                      {/* Model settings (common for both existing and inline prompts) */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Temperature
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={step.config.modelSettings?.temperature || 0.7}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                modelSettings: {
                                  ...step.config.modelSettings,
                                  temperature: parseFloat(e.target.value)
                                }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Max Tokens
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="4000"
                            value={step.config.modelSettings?.maxTokens || 1000}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                modelSettings: {
                                  ...step.config.modelSettings,
                                  maxTokens: parseInt(e.target.value)
                                }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Model
                          </label>
                          <select
                            value={step.config.modelSettings?.model || 'gpt-3.5-turbo'}
                            onChange={(e) => updateStep(index, {
                              config: {
                                ...step.config,
                                modelSettings: {
                                  ...step.config.modelSettings,
                                  model: e.target.value
                                }
                              }
                            })}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            <option value="gpt-4">GPT-4</option>
                            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                            <option value="claude-3-haiku">Claude 3 Haiku</option>
                          </select>
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