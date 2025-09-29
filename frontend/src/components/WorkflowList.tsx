import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { workflowsAPI } from '../services/api';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  isActive: boolean;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
  steps: {
    id: string;
    name: string;
    type: string;
    order: number;
  }[];
  _count: {
    executions: number;
  };
}

export default function WorkflowList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const data = await workflowsAPI.getWorkflows({
        search: search || undefined,
        limit: 50,
        offset: 0
      });
      
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflows';
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
  };

  useEffect(() => {
    fetchWorkflows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteWorkflow = async (workflowId: string) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    try {
      await workflowsAPI.deleteWorkflow(workflowId);
      setWorkflows(workflows.filter(w => w.id !== workflowId));
    } catch (err) {
      console.error('Error deleting workflow:', err);
      alert('Failed to delete workflow');
    }
  };

  const filteredWorkflows = workflows.filter(workflow => 
    workflow.name.toLowerCase().includes(search.toLowerCase()) ||
    (workflow.description && workflow.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-2 text-gray-600">
            Create and manage automated prompt workflows
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/workflows/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <span className="mr-2">+</span>
            New Workflow
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-6">
        <div className="max-w-md">
          <label htmlFor="search" className="sr-only">
            Search workflows
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="search"
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
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

      {/* Workflows Grid */}
      {filteredWorkflows.length === 0 && !loading ? (
        <div className="mt-8 text-center">
          <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔄</span>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new workflow.
          </p>
          <div className="mt-6">
            <Link
              to="/workflows/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <span className="mr-2">+</span>
              New Workflow
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {workflow.name}
                    </h3>
                    {workflow.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {workflow.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      workflow.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="font-medium">{workflow.steps.length}</span>
                    <span className="ml-1">steps</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">{workflow._count.executions}</span>
                    <span className="ml-1">runs</span>
                  </div>
                  <div>
                    <span>v{workflow.version}</span>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  Updated {format(new Date(workflow.updatedAt), 'MMM d, yyyy')}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex space-x-2">
                    <Link
                      to={`/workflows/${workflow.id}`}
                      className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                    >
                      View
                    </Link>
                    <Link
                      to={`/workflows/${workflow.id}/edit`}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                  <button
                    onClick={() => deleteWorkflow(workflow.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>

                {workflow.steps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Steps:</p>
                    <div className="flex flex-wrap gap-1">
                      {workflow.steps.slice(0, 3).map((step) => (
                        <span
                          key={step.id}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          {step.name}
                        </span>
                      ))}
                      {workflow.steps.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{workflow.steps.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}