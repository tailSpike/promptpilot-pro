import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface WorkflowStep {
  id?: string;
  name: string;
  type: 'PROMPT' | 'CONDITION' | 'TRANSFORM' | 'DELAY' | 'WEBHOOK' | 'DECISION';
  order: number;
  config: Record<string, unknown>;
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

  useEffect(() => {
    if (isEditing) {
      fetchWorkflow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing]);

  const fetchWorkflow = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/workflows/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      setWorkflow({
        id: data.id,
        name: data.name,
        description: data.description || '',
        steps: data.steps || [],
        isActive: data.isActive
      });
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflow.name.trim()) {
      setError('Workflow name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const url = isEditing 
        ? `${import.meta.env.VITE_API_URL}/api/workflows/${id}`
        : `${import.meta.env.VITE_API_URL}/api/workflows`;
        
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: workflow.name,
          description: workflow.description,
          isActive: workflow.isActive
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save workflow');
      }

      const savedWorkflow = await response.json();

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
      setError((err as Error).message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const saveStepToBackend = async (workflowId: string, step: WorkflowStep) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/workflows/${workflowId}/steps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name: step.name,
        type: step.type,
        order: step.order,
        config: step.config,
        promptId: step.promptId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save step');
    }

    return response.json();
  };

  const addStep = async () => {
    const newStep: WorkflowStep = {
      name: `Step ${workflow.steps.length + 1}`,
      type: 'PROMPT',
      order: workflow.steps.length + 1,
      config: {}
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

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, ...updates } : step
      )
    }));
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
                <p>{error}</p>
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
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingStep ? 'Adding...' : '+ Add Step'}
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
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Step {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Step Name
                      </label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(index, { name: e.target.value })}
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
                </div>
              ))}
            </div>
          )}
        </div>

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
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update Workflow' : 'Create Workflow')}
          </button>
        </div>
      </form>
    </div>
  );
}