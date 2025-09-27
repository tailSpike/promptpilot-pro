import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { workflowsAPI } from '../services/api';
import WorkflowTriggers from './WorkflowTriggers';

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  order: number;
  config: string | Record<string, unknown>; // Can be JSON string or parsed object
  promptId?: string;
  prompt?: {
    id: string;
    name: string;
    content: string;
    variables: Record<string, unknown>;
  };
}

interface WorkflowExecution {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  version?: string;
  isActive: boolean;
  isTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  tags: string[];
  steps: WorkflowStep[];
  executions: WorkflowExecution[];
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function WorkflowDetail() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const [executing, setExecuting] = useState(false);
  const [executionInput, setExecutionInput] = useState('{}');

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchWorkflow = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const data = await workflowsAPI.getWorkflow(id);
      setWorkflow(data);
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const executeWorkflow = async () => {
    if (!id || !workflow) return;
    
    try {
      setExecuting(true);
      
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(executionInput);
      } catch {
        throw new Error('Invalid JSON in input field');
      }

      const result = await workflowsAPI.executeWorkflow(id, input);
      console.log('Workflow execution started:', result);
      
      // Refresh workflow data to show new execution
      await fetchWorkflow();
      
    } catch (err) {
      console.error('Error executing workflow:', err);
      setError((err as Error).message || 'Failed to execute workflow');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Workflow not found'}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link
            to="/workflows"
            className="text-purple-600 hover:text-purple-900 text-sm font-medium"
          >
            ← Back to Workflows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{workflow.name}</h1>
            {workflow.description && (
              <p className="mt-2 text-gray-600">{workflow.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/workflows/${workflow.id}/edit`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Edit
            </Link>
            <Link
              to="/workflows"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Workflow Information</h2>
            
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    workflow.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {workflow.isActive ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Executions</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {workflow.executions?.length || 0}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(workflow.createdAt), 'MMM d, yyyy')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(workflow.updatedAt), 'MMM d, yyyy')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Steps</dt>
                <dd className="mt-1 text-sm text-gray-900">{workflow.steps?.length || 0} steps</dd>
              </div>
            </dl>
          </div>

          {/* Workflow Steps */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Workflow Steps</h2>
              <Link
                to={`/workflows/${workflow.id}/edit?openAddStep=1`}
                data-testid="detail-add-step-button"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200"
                title="Add a new step to this workflow"
              >
                Add Step
              </Link>
            </div>
            
            {!workflow.steps || workflow.steps.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🔄</span>
                </div>
                <h3 className="text-sm font-medium text-gray-900">No steps configured</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Use the Add Step button to create your first step.
                </p>
                <div className="mt-4">
                  <Link
                    to={`/workflows/${workflow.id}/edit?openAddStep=1`}
                    data-testid="detail-empty-add-step-button"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                  >
                    Add Step
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {workflow.steps
                  .sort((a, b) => a.order - b.order)
                  .map((step, index) => (
                    <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-purple-800">
                              {index + 1}
                            </span>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-gray-900">
                              {step.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Type: {step.type}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Workflow Triggers */}
          <WorkflowTriggers 
            workflowId={workflow.id} 
            onTriggerExecuted={(triggerId) => {
              console.log(`Trigger ${triggerId} executed - refreshing workflow data`);
              fetchWorkflow(); // Refresh executions list
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Execute Workflow */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Execute Workflow</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="input" className="block text-sm font-medium text-gray-700">
                  Input Data (JSON)
                </label>
                <textarea
                  id="input"
                  rows={4}
                  value={executionInput}
                  onChange={(e) => setExecutionInput(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                  placeholder='{"key": "value"}'
                />
              </div>
              
              <button
                onClick={executeWorkflow}
                disabled={executing || !workflow.isActive}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executing ? 'Executing...' : 'Execute Workflow'}
              </button>
              
              {!workflow.isActive && (
                <p className="text-xs text-gray-500">
                  This workflow is inactive and cannot be executed.
                </p>
              )}
            </div>
          </div>

          {/* Recent Executions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Executions</h2>
            
            {workflow.executions && workflow.executions.length > 0 ? (
              <div className="space-y-3">
                {workflow.executions.slice(0, 5).map((execution) => (
                  <div key={execution.id} className="border border-gray-200 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        execution.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        execution.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        execution.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {execution.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(execution.startedAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No executions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}