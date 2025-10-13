import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { workflowsAPI, integrationsAPI } from '../services/api';
import WorkflowTriggers from './WorkflowTriggers';
import WorkflowPreviewResults, { type WorkflowPreviewResult } from './WorkflowPreviewResults';

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
  completedAt?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface WorkflowVariable {
  id: string;
  name: string;
  type: string;
  dataType: string;
  isRequired: boolean;
  defaultValue?: unknown;
  description?: string | null;
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
  variables?: WorkflowVariable[];
}

// Normalize prompt.variables shape to a flat array
function normalizePromptVariables(value: unknown): Array<{ name: string; type?: string; isRequired?: boolean }> {
  if (!value) return [];
  let v: unknown = value;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item !== 'object' || !item) return { name: '' };
        const obj = item as { name?: string; dataType?: string; type?: string; isRequired?: boolean; required?: boolean };
        return { name: obj.name ?? '', type: obj.dataType || obj.type, isRequired: Boolean(obj.isRequired || obj.required) };
      })
      .filter((x) => Boolean(x?.name));
  }
  if (typeof v === 'object' && v) {
    const obj = v as { items?: unknown; variables?: unknown };
    const arr = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.variables) ? obj.variables : [];
    return (arr as unknown[])
      .map((item) => {
        if (typeof item !== 'object' || !item) return { name: '' };
        const o = item as { name?: string; dataType?: string; type?: string; isRequired?: boolean; required?: boolean };
        return { name: o.name ?? '', type: o.dataType || o.type, isRequired: Boolean(o.isRequired || o.required) };
      })
      .filter((x) => Boolean(x?.name));
  }
  return [];
}

// Helper function to syntax highlight JSON
function SyntaxHighlightedJSON({ data }: { data: unknown }) {
  const jsonString = JSON.stringify(data, null, 2);
  
  const highlightJSON = (str: string) => {
    return str
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        let cls = 'text-amber-200'; // Strings
        if (/:$/.test(match)) {
          cls = 'text-sky-300'; // Keys
        }
        return `<span class="${cls}">${match}</span>`;
      })
      .replace(/\b(true|false)\b/g, '<span class="text-fuchsia-300">$1</span>') // Booleans
      .replace(/\b(null)\b/g, '<span class="text-rose-300">$1</span>') // null
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="text-emerald-300">$1</span>'); // Numbers
  };

  return (
    <pre className="text-[13px] font-mono leading-6 whitespace-pre-wrap break-words text-slate-100 w-full max-w-full">
      <code dangerouslySetInnerHTML={{ __html: highlightJSON(jsonString) }} />
    </pre>
  );
}

// Robust JSON parser that handles double-encoded JSON strings safely
function parseJsonDeep<T = unknown>(value: unknown): T | undefined {
  let current: unknown = value;
  // Try up to 2 parses to handle double-encoded strings
  for (let i = 0; i < 2; i++) {
    if (typeof current === 'string') {
      const trimmed = current.trim();
      const looksJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
      if (looksJson) {
        try {
          current = JSON.parse(trimmed);
          continue; // Try parsing again if result is still a string
        } catch {
          // Stop parsing if invalid JSON
          break;
        }
      }
    }
    break;
  }
  return current as T;
}

export default function WorkflowDetail() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const [executing, setExecuting] = useState(false);
  const [executionInput, setExecutionInput] = useState('{}');
  const [useSampleData, setUseSampleData] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<WorkflowPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Render the preview panel immediately on click to avoid flakiness while data loads
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  // Collapsible execution reports
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  // Filters for reports
  const [filterQuery, setFilterQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'FAILED' | 'RUNNING' | 'PENDING'>('ALL');
  // Compact details per execution (hides tokens/model/input params when true)
  const [compactIds, setCompactIds] = useState<Record<string, boolean>>({});
  // Modal state for fullscreen JSON
  const [jsonModal, setJsonModal] = useState<{ open: boolean; title?: string; data?: unknown }>({ open: false });
  // Pagination limit
  const [execLimit, setExecLimit] = useState(10);
  // Smart form state for small variable sets
  const [formInputs, setFormInputs] = useState<Record<string, unknown>>({});
  const [copiedCurl, setCopiedCurl] = useState(false);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // Persist per-workflow
      if (id && workflow?.id) {
        localStorage.setItem(`workflow:${workflow.id}:expandedStates`, JSON.stringify(next));
      }
      return next;
    });
  };

  const toggleCompact = (id: string) => {
    setCompactIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Hydrate expanded states from localStorage when workflow loads
  useEffect(() => {
    if (!workflow?.id) return;
    const raw = localStorage.getItem(`workflow:${workflow.id}:expandedStates`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setExpandedIds(parsed);
      } catch {
        // ignore
      }
    }
  }, [workflow?.id]);

  const parseDefaultValue = (value: unknown): unknown => {
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
  };

  const generatePlaceholderValue = (dataType: string, variableName: string): unknown => {
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
  };

  const buildSampleInput = (variables?: WorkflowVariable[]): Record<string, unknown> => {
    if (!variables) {
      return {};
    }

    return variables
      .filter((variable) => variable.type === 'input')
      .reduce<Record<string, unknown>>((acc, variable) => {
        const defaultValue = parseDefaultValue(variable.defaultValue);
        acc[variable.name] = defaultValue !== undefined
          ? defaultValue
          : generatePlaceholderValue(variable.dataType, variable.name);
        return acc;
      }, {});
  };

  const handleGenerateSampleInput = () => {
    if (!workflow?.variables) {
      return;
    }

    const sample = buildSampleInput(workflow.variables);
    if (Object.keys(sample).length > 0) {
      setExecutionInput(JSON.stringify(sample, null, 2));
      setPreviewResult(null);
      setPreviewError(null);
    }
  };

  // Compute first prompt step placeholders (for display only)
  const firstPromptPlaceholders = useMemo(() => {
    if (!workflow?.steps) return [] as Array<{ name: string; isRequired?: boolean }>;
    const firstPrompt = [...workflow.steps].sort((a, b) => a.order - b.order).find((s) => s.type === 'PROMPT' && s.prompt);
    if (!firstPrompt?.prompt) return [];
    const vars = normalizePromptVariables(firstPrompt.prompt.variables);
    return vars;
  }, [workflow?.steps]);

  // Smart form should appear when there are 1–3 input variables and all are simple types
  const inputVariables = useMemo(() => (workflow?.variables || []).filter(v => v.type === 'input'), [workflow?.variables]);
  const showSmartForm = useMemo(() => {
    if (!inputVariables || inputVariables.length === 0) return false;
    if (inputVariables.length > 3) return false;
    // Only simple types supported inline
    return inputVariables.every(v => ['string', 'number', 'boolean'].includes(v.dataType));
  }, [inputVariables]);

  // Sync JSON textarea -> smart form values (for known keys)
  useEffect(() => {
    if (!showSmartForm) return;
    try {
      const parsed = JSON.parse(executionInput || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const next: Record<string, unknown> = { ...formInputs };
        for (const v of inputVariables) {
          if (Object.prototype.hasOwnProperty.call(parsed as Record<string, unknown>, v.name)) {
            next[v.name] = (parsed as Record<string, unknown>)[v.name];
          }
        }
        setFormInputs(next);
      }
    } catch {
      // ignore invalid JSON
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionInput, showSmartForm, inputVariables.map(v => v.name).join('|')]);

  // Helper to update both formInputs and JSON text coherently
  const updateFormValue = (name: string, raw: unknown, dataType: string) => {
    let value: unknown = raw;
    if (dataType === 'number') {
      const n = typeof raw === 'string' ? Number(raw) : Number(raw);
      value = Number.isFinite(n) ? n : undefined;
    } else if (dataType === 'boolean') {
      value = Boolean(raw);
    } else {
      // string
      value = raw as string;
    }
    const nextForm = { ...formInputs, [name]: value };
    setFormInputs(nextForm);
    // Merge into JSON
    let current: Record<string, unknown> = {};
    try { current = JSON.parse(executionInput || '{}') as Record<string, unknown>; } catch { current = {}; }
    if (value === undefined) {
      delete current[name];
    } else {
      current[name] = value;
    }
    setExecutionInput(JSON.stringify(current, null, 2));
  };

  const buildCurlCommand = () => {
  const apiUrl: string = (import.meta.env as unknown as { VITE_API_URL?: string }).VITE_API_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token') || '<YOUR_TOKEN>';
    let body: string;
    try {
      const parsed = JSON.parse(executionInput || '{}');
      body = JSON.stringify({ input: parsed, triggerType: 'manual' });
    } catch {
      body = JSON.stringify({ input: {}, triggerType: 'manual' });
    }
    const url = `${apiUrl}/api/workflows/${workflow?.id}/execute`;
    // Use single quotes for most shells; escaping handled minimally
    return `curl -X POST "${url}" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${body.replace(/'/g, "'\\''")}'`;
  };

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Polling effect - check for running executions every 3 seconds
  useEffect(() => {
    if (!id || !workflow) return;

    // Check if there are any running or pending executions
    const hasActiveExecutions = workflow.executions?.some(
      exec => exec.status === 'RUNNING' || exec.status === 'PENDING'
    );

    if (hasActiveExecutions && !pollingEnabled) {
      setPollingEnabled(true);
    }

    if (!hasActiveExecutions && pollingEnabled) {
      setPollingEnabled(false);
    }

    if (!pollingEnabled) return;

    const interval = setInterval(() => {
      fetchWorkflow({ silent: true });
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, workflow?.executions, pollingEnabled]);

  const fetchWorkflow = async (opts?: { silent?: boolean }) => {
    if (!id) return;
    const silent = Boolean(opts?.silent);
    try {
      if (!silent) setLoading(true);
      const data = await workflowsAPI.getWorkflow(id);
      // Also fetch executions to populate the execution history sidebar and satisfy tests
      try {
        const execs = await workflowsAPI.getWorkflowExecutions(id);
        const executions = Array.isArray((execs as unknown as { executions?: unknown[] })?.executions)
          ? (execs as unknown as { executions: WorkflowExecution[] }).executions
          : (Array.isArray(execs) ? (execs as unknown as WorkflowExecution[]) : []);
        setWorkflow({ ...data, executions });
      } catch {
        // If executions endpoint fails or returns unexpected shape, still set workflow data
        setWorkflow(data);
      }

      if ((executionInput.trim() === '{}' || executionInput.trim() === '') && data?.variables?.length) {
        const sample = buildSampleInput(data.variables);
        if (Object.keys(sample).length > 0) {
          setExecutionInput(JSON.stringify(sample, null, 2));
          setUseSampleData(true);
        }
      }
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError('Failed to load workflow');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const executeWorkflow = async () => {
    if (!id || !workflow) return;
    
    try {
      setExecuting(true);
      setError(null);
      
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(executionInput);
      } catch {
        throw new Error('Invalid JSON in input field');
      }

      if (input === null || Array.isArray(input) || typeof input !== 'object') {
        throw new Error('Input must be a JSON object.');
      }

      await workflowsAPI.executeWorkflow(id, input, 'manual');
      
      // Enable polling to watch for completion
      setPollingEnabled(true);
      
  // Refresh workflow data to show new execution without jumping
  await fetchWorkflow({ silent: true });
      
    } catch (err) {
      console.error('Error executing workflow:', err);
      setError((err as Error).message || 'Failed to execute workflow');
    } finally {
      setExecuting(false);
    }
  };

  const runPreview = async () => {
    if (!id || !workflow) return;

    try {
      setPreviewing(true);
      setPreviewError(null);

      let parsedInput: Record<string, unknown> | undefined;
      if (executionInput.trim()) {
        try {
          parsedInput = JSON.parse(executionInput);
        } catch {
          throw new Error('Invalid JSON in input field');
        }
      }

      const payload: { input?: Record<string, unknown>; useSampleData?: boolean; simulateOnly?: boolean } = {};

      if (typeof parsedInput !== 'undefined') {
        if (parsedInput === null || Array.isArray(parsedInput) || typeof parsedInput !== 'object') {
          throw new Error('Input must be a JSON object.');
        }
      }

      if (parsedInput && Object.keys(parsedInput).length > 0) {
        payload.input = parsedInput;
      }

  payload.useSampleData = useSampleData || !payload.input;
  // Always simulate-only for preview to keep it fast and offline
  payload.simulateOnly = true;

      // At this point validation passed — display the preview panel
      setShowPreviewPanel(true);

      // Attach credentials map if available to support provider validation during preview
      try {
        const creds = await integrationsAPI.getCredentials();
        if (creds && Array.isArray(creds.credentials) && creds.credentials.length > 0) {
          const map: Record<string, string[]> = {};
          for (const c of creds.credentials) {
            if (!map[c.provider]) map[c.provider] = [];
            // Use label as a human-friendly handle; server can resolve secrets securely by label+provider
            map[c.provider].push(c.label);
          }
          (payload as { credentials?: Record<string, string[]> }).credentials = map;
        }
      } catch {
        // Non-fatal: preview should still work without credentials
      }

      const preview = await workflowsAPI.previewWorkflow(id, payload);
      setPreviewResult(preview);
    } catch (err) {
      console.error('Error previewing workflow:', err);
      // If backend returns a structured FAILED preview payload with 4xx (e.g., 409), surface it
      if (axios.isAxiosError(err) && err.response && err.response.data) {
        const data = err.response.data as Partial<WorkflowPreviewResult> & Record<string, unknown>;
        const looksLikePreview = typeof data === 'object' && (
          data.status === 'FAILED' || data.status === 'COMPLETED'
        );
        if (looksLikePreview) {
          setPreviewResult(data as WorkflowPreviewResult);
          setPreviewError(null);
          setPreviewing(false);
          return;
        }
      }
      setPreviewError((err as Error).message || 'Failed to preview workflow');
      setPreviewResult(null);
    } finally {
      setPreviewing(false);
    }
  };

  const clearPreview = () => {
    setPreviewResult(null);
    setPreviewError(null);
    setShowPreviewPanel(false);
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
              {/* Local helper to safely format dates */}
              {(() => {
                function safeFormatDate(val?: string) {
                  if (!val) return '—';
                  const d = new Date(val);
                  if (Number.isNaN(d.getTime())) return '—';
                  try {
                    return format(d, 'MMM d, yyyy');
                  } catch {
                    return '—';
                  }
                }
                return (
                  <>
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
                  {safeFormatDate(workflow.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {safeFormatDate(workflow.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Steps</dt>
                <dd className="mt-1 text-sm text-gray-900">{workflow.steps?.length || 0} steps</dd>
              </div>
                  </>
                );
              })()}
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
            inputForTrigger={((): Record<string, unknown> | undefined => {
              try {
                const parsed = JSON.parse(executionInput || '{}');
                return parsed && typeof parsed === 'object' ? parsed : undefined;
              } catch {
                return undefined; // ignore parse errors, backend will sample inputs
              }
            })()}
            onTriggerExecuted={() => {
              fetchWorkflow({ silent: true }); // Refresh executions list silently
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Execute Workflow */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Execute Workflow</h2>
            
            <div className="space-y-4">
              {/* Required placeholders quick view from first prompt */}
              {firstPromptPlaceholders.length > 0 && (
                <div className="rounded border border-purple-100 bg-purple-50 p-3 text-xs text-purple-900">
                  <div className="font-medium mb-1">Placeholders used in first prompt:</div>
                  <div className="flex flex-wrap gap-2">
                    {firstPromptPlaceholders.map((v) => {
                      const ph = `{{${v.name}}}`;
                      return (
                        <span key={v.name} className="inline-flex items-center rounded-full bg-white border border-purple-200 px-2 py-0.5">
                          <span className="font-mono text-[11px] text-purple-700">{ph}</span>
                          {v.isRequired ? <span className="ml-1 text-[10px] text-rose-600">*</span> : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Smart form for small/simple input variables */}
              {showSmartForm && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-600">Quick inputs</div>
                  {inputVariables.map((v) => (
                    <div key={v.id} className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-xs text-gray-700" htmlFor={`wfvar-${v.name}`}>
                        {v.name} {v.isRequired ? <span className="text-rose-600">*</span> : null}
                      </label>
                      {v.dataType === 'boolean' ? (
                        <input
                          id={`wfvar-${v.name}`}
                          type="checkbox"
                          className="h-4 w-4 text-purple-600 border-gray-300 rounded"
                          checked={Boolean(formInputs[v.name])}
                          onChange={(e) => updateFormValue(v.name, e.target.checked, 'boolean')}
                        />
                      ) : (
                        <input
                          id={`wfvar-${v.name}`}
                          type={v.dataType === 'number' ? 'number' : 'text'}
                          value={
                            v.dataType === 'number'
                              ? (typeof formInputs[v.name] === 'number' || typeof formInputs[v.name] === 'string' ? String(formInputs[v.name] ?? '') : '')
                              : (typeof formInputs[v.name] === 'string' ? (formInputs[v.name] as string) : (formInputs[v.name] != null ? String(formInputs[v.name]) : ''))
                          }
                          onChange={(e) => updateFormValue(v.name, e.target.value, v.dataType)}
                          placeholder={v.dataType === 'number' ? '0' : 'Enter text...'}
                          className="col-span-2 text-xs border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        />
                      )}
                    </div>
                  ))}
                  <div className="text-[11px] text-gray-500">These fields sync with the JSON input below.</div>
                </div>
              )}

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
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-purple-600 border-gray-300 rounded"
                    checked={useSampleData}
                    onChange={(event) => setUseSampleData(event.target.checked)}
                  />
                  <span className="ml-2">Auto-fill missing inputs with sample data</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSampleInput}
                  className="text-sm font-medium text-purple-600 hover:text-purple-800"
                >
                  Insert sample input
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={runPreview}
                  disabled={previewing}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="workflow-preview-button"
                >
                  {previewing ? 'Previewing...' : 'Preview Workflow'}
                </button>
                <button
                  type="button"
                  onClick={executeWorkflow}
                  disabled={executing || !workflow.isActive}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executing ? 'Executing...' : 'Execute Workflow'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildCurlCommand());
                      setCopiedCurl(true);
                      setTimeout(() => setCopiedCurl(false), 1500);
                    } catch {
                      setCopiedCurl(false);
                    }
                  }}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  title="Copy a ready-to-run cURL command"
                >
                  {copiedCurl ? 'Copied cURL!' : 'Copy cURL'}
                </button>
              </div>

              {!workflow.isActive && (
                <p className="text-xs text-gray-500">
                  This workflow is inactive and cannot be executed.
                </p>
              )}

              {previewError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {previewError}
                </div>
              )}
            </div>
          </div>

          {/* Recent Executions - moved to full-width section below */}
        </div>

        {/* Sidebar end */}
      </div>

      {/* Full-width Preview + Execution Reports */}
      <div className="mt-8">
        {showPreviewPanel && (
          <div className="mb-6">
            {previewResult ? (
              <WorkflowPreviewResults preview={previewResult} onClear={clearPreview} />
            ) : (
              <div
                className="bg-white shadow rounded-lg p-6 space-y-4"
                data-testid="workflow-preview-results"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-3">
                      Test Run Summary
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800" data-testid="workflow-preview-status">
                        Loading…
                      </span>
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Preparing preview…</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Execution Reports</h2>
            {pollingEnabled && (
              <div className="flex items-center space-x-2 text-xs text-blue-600">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium">Auto-refreshing...</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter by generated text, model, provider, or finish reason..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'COMPLETED' | 'FAILED' | 'RUNNING' | 'PENDING')}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="RUNNING">Running</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {workflow.executions && workflow.executions.length > 0 ? (
            <>
            <div className="space-y-4">
              {workflow.executions
                .slice(0, execLimit)
                .filter((execution) => {
                  if (filterStatus !== 'ALL' && execution.status !== filterStatus) return false;
                  if (!filterQuery.trim()) return true;
                  const hay = JSON.stringify(execution).toLowerCase();
                  return hay.includes(filterQuery.toLowerCase());
                })
                .map((execution) => {
                  // Calculate duration if completed
                  const duration = execution.completedAt 
                    ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
                    : null;
                  
                  // Extract key output data
                  // Parse output robustly (handles double-encoded JSON)
                  const output = parseJsonDeep<Record<string, unknown> | undefined>(execution.output);
                  
                  // For actual executions, data is nested under finalResult
                  const finalResult = (output as Record<string, unknown>)?.finalResult as Record<string, unknown> | undefined;
                  const executionData = finalResult || (output as Record<string, unknown>);
                  type StepTrace = { meta?: { id?: string; name?: string; type?: string; order?: number; outputsMapping?: Record<string, unknown> }; inputSnapshot?: Record<string, unknown>; durationMs?: number; output?: Record<string, unknown>; exported?: Record<string, unknown> };
                  const stepTraces = (output as Record<string, unknown>)?.stepResults as Record<string, StepTrace> | undefined;
                  
                  const generatedText = executionData?.generatedText as string | undefined || executionData?.text as string | undefined || executionData?.result as string | undefined;
                  const generatedTextRef = executionData?.generatedTextRef as (undefined | { id: string; size: number; mimeType?: string; preview?: string });
                  const tokensUsed = executionData?.tokensUsed as number | undefined || executionData?.tokens as number | undefined;
                  const model = executionData?.model as string | undefined;
                  const provider = executionData?.provider as string | undefined || executionData?.primaryProvider as string | undefined;
                  const promptTokens = executionData?.promptTokens as number | undefined;
                  const completionTokens = executionData?.completionTokens as number | undefined;
                  const finishReason = executionData?.finishReason as string | undefined;
                  
                  // Parse input robustly as well
                  const parsedInput = parseJsonDeep<Record<string, unknown> | undefined>(execution.input);
                  
                  const isExpanded = expandedIds[execution.id] ?? true;
                  const summaryText = [
                    generatedText ? `${(generatedText || '').slice(0, 80)}${(generatedText || '').length > 80 ? '…' : ''}` : null,
                    typeof tokensUsed === 'number' ? `Tokens: ${tokensUsed}` : null,
                    duration !== null ? `Duration: ${duration}s` : null,
                    model ? `Model: ${model}` : null,
                    provider ? `Provider: ${provider}` : null,
                    finishReason ? `Finish: ${finishReason}` : null,
                  ].filter(Boolean).join(' • ');

                  return (
                    <div key={execution.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Collapsible Summary Header */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(execution.id)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between ${
                        execution.status === 'COMPLETED' ? 'bg-green-50 border-b border-green-200' :
                        execution.status === 'FAILED' ? 'bg-red-50 border-b border-red-200' :
                        execution.status === 'RUNNING' ? 'bg-blue-50 border-b border-blue-200' :
                        'bg-yellow-50 border-b border-yellow-200'
                      }`}
                        aria-expanded={isExpanded}
                      >
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          execution.status === 'COMPLETED' ? 'bg-green-600 text-white' :
                          execution.status === 'FAILED' ? 'bg-red-600 text-white' :
                          execution.status === 'RUNNING' ? 'bg-blue-600 text-white' :
                          'bg-yellow-600 text-white'
                        }`}>
                          {execution.status}
                        </span>
                        <div className="flex-1 mx-3 hidden md:block">
                          <div className="text-sm text-gray-800 truncate" title={summaryText}>{summaryText || 'No summary available'}</div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {format(new Date(execution.startedAt), 'MMM d, yyyy • h:mm:ss a')}
                        </div>
                      </button>

                      {isExpanded && (
                      <div className="p-5 space-y-5">
                        {/* Card controls */}
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">Execution ID: {execution.id}</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                              onClick={() => toggleCompact(execution.id)}
                            >
                              {compactIds[execution.id] ? 'Expanded view' : 'Compact view'}
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                              onClick={() => {
                                const text = JSON.stringify(output ?? execution.output ?? {}, null, 2);
                                navigator.clipboard?.writeText(text);
                              }}
                              title="Copy JSON"
                            >
                              Copy JSON
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                              onClick={() => setJsonModal({ open: true, title: `Execution ${execution.id} • Raw JSON`, data: output ?? execution.output ?? {} })}
                              title="Open fullscreen"
                            >
                              Fullscreen
                            </button>
                          </div>
                        </div>
                        {/* Running/Pending State */}
                        {(execution.status === 'RUNNING' || execution.status === 'PENDING') && (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                              <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <p className="text-sm font-medium text-gray-700">
                                {execution.status === 'RUNNING' ? 'Execution in progress...' : 'Waiting to start...'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">This page will update automatically</p>
                            </div>
                          </div>
                        )}

                        {/* COMPLETED Execution - Full Report */}
                        {execution.status === 'COMPLETED' && (
                          <>
                            {/* Execution Summary Bar */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-bold text-gray-900">Execution Completed Successfully</h3>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      {format(new Date(execution.startedAt), 'EEEE, MMMM d, yyyy')} at {format(new Date(execution.startedAt), 'h:mm:ss a')}
                                      {execution.completedAt && (
                                        <span className="ml-2 text-gray-500">
                                          • Completed at {format(new Date(execution.completedAt), 'h:mm:ss a')}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                {duration !== null && (
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-green-700">{duration}s</div>
                                    <div className="text-xs text-green-600 font-medium">Total Time</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Step-by-step breakdown (if available) */}
                            {stepTraces && typeof stepTraces === 'object' && (
                              <div className="bg-white border-2 border-amber-200 rounded-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 border-b border-amber-200">
                                  <h3 className="text-sm font-bold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10" />
                                    </svg>
                                    Step Results
                                  </h3>
                                </div>
                                <div className="p-5 space-y-3">
                                  {Object.entries(stepTraces)
                                    .sort(([, aVal], [, bVal]) => {
                                      const ao = aVal?.meta?.order ?? 0; const bo = bVal?.meta?.order ?? 0; return ao - bo;
                                    })
                                    .map(([key, trace]) => {
                                      const meta = trace?.meta; const inputSnap = trace?.inputSnapshot; const exported = trace?.exported; const out = trace?.output;
                                      return (
                                        <details key={key} className="group rounded border border-amber-200 bg-amber-50">
                                          <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-2">
                                            <span className="text-sm font-medium text-gray-800">
                                              {(meta?.order ?? 0) + 1}. {meta?.name || key} <span className="ml-2 text-gray-500">{meta?.type}</span>
                                            </span>
                                            <span className="text-xs text-gray-600">{trace?.durationMs ? `${trace.durationMs}ms` : ''}</span>
                                          </summary>
                                          <div className="px-4 pb-4 space-y-2 text-xs">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              <div>
                                                <div className="font-semibold text-gray-700 mb-1">Input snapshot</div>
                                                <pre className="bg-white border border-amber-200 rounded p-2 overflow-auto">{JSON.stringify(inputSnap ?? {}, null, 2)}</pre>
                                              </div>
                                              <div>
                                                <div className="font-semibold text-gray-700 mb-1">Output</div>
                                                <pre className="bg-white border border-amber-200 rounded p-2 overflow-auto">{JSON.stringify(out ?? {}, null, 2)}</pre>
                                              </div>
                                            </div>
                                            {/* Step AI Response Preview (if available) */}
                                            {(() => {
                                              if (!out || typeof out !== 'object') return null;
                                              const o = out as Record<string, unknown>;
                                              const gt = typeof o.generatedText === 'string' ? o.generatedText : undefined;
                                              const gtr = (o.generatedTextRef as undefined | { id: string; size: number; mimeType?: string; preview?: string });
                                              if (!gt && !gtr) return null;
                                              return (
                                              <div className="mt-2">
                                                <div className="font-semibold text-gray-700 mb-1">AI Response Preview</div>
                                                {gt && (
                                                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words bg-white p-3 rounded border border-amber-200 max-h-64 overflow-y-auto">
                                                    {gt}
                                                  </div>
                                                )}
                                                {!gt && gtr && (
                                                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words rounded-lg bg-white p-3 border border-amber-200">
                                                    <div className="flex items-center justify-between">
                                                      <div className="text-xs text-gray-700">Full step output stored as document.</div>
                                                      <a href={`/api/documents/${gtr.id}/download`} className="text-xs font-medium text-purple-700 hover:text-purple-900" title="Download full step output">Download</a>
                                                    </div>
                                                    {gtr.preview && (
                                                      <div className="mt-2 text-[11px] text-gray-600 max-h-48 overflow-y-auto border-t pt-2">
                                                        <div className="mb-1 font-semibold">Preview:</div>
                                                        <div className="font-mono whitespace-pre-wrap break-words">{gtr.preview}</div>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                              );
                                            })()}
                                            {exported && (
                                              <div>
                                                <div className="font-semibold text-gray-700 mb-1">Exported variables → available to next steps</div>
                                                <pre className="bg-white border border-amber-200 rounded p-2 overflow-auto">{JSON.stringify(exported, null, 2)}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </details>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {/* AI Response Section */}
                            {(generatedText || generatedTextRef) && (
                              <div className="bg-white border-2 border-blue-200 rounded-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-200">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center">
                                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                      </svg>
                                      AI Generated Response
                                    </h3>
                                    {generatedText && (
                                      <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                                        {generatedText.length.toLocaleString()} characters
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50">
                                  <div className="prose prose-sm max-w-none">
                                    {generatedText && (
                                      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words max-h-96 overflow-y-auto rounded-lg bg-white p-4 shadow-inner border border-gray-200">
                                        {generatedText}
                                      </div>
                                    )}
                                    {(!generatedText && generatedTextRef) && (
                                      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words rounded-lg bg-white p-4 shadow-inner border border-gray-200">
                                        <div className="flex items-center justify-between">
                                          <div className="text-sm text-gray-700">Full output stored as document.</div>
                                          <a
                                            href={`/api/documents/${generatedTextRef.id}/download`}
                                            className="text-sm font-medium text-purple-700 hover:text-purple-900"
                                            title="Download full generated output"
                                          >
                                            Download full output
                                          </a>
                                        </div>
                                        {generatedTextRef.preview && (
                                          <div className="mt-3 text-xs text-gray-600 max-h-64 overflow-y-auto border-t pt-3">
                                            <div className="mb-1 font-semibold">Preview:</div>
                                            <div className="font-mono whitespace-pre-wrap break-words">{generatedTextRef.preview}</div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Token Usage Statistics */}
                            {!compactIds[execution.id] && (
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Token Usage & Performance
                              </h4>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {promptTokens !== undefined && (
                                  <div className="bg-white rounded-lg p-2.5 text-center border border-indigo-200 shadow-sm">
                                    <div className="text-xl font-bold text-indigo-700 whitespace-nowrap tabular-nums">{promptTokens.toLocaleString()}</div>
                                    <div className="text-[11px] text-indigo-600 font-medium mt-1 whitespace-nowrap leading-tight">Prompt Tokens</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">Input</div>
                                  </div>
                                )}
                                {completionTokens !== undefined && (
                                  <div className="bg-white rounded-lg p-2.5 text-center border border-pink-200 shadow-sm">
                                    <div className="text-xl font-bold text-pink-700 whitespace-nowrap tabular-nums">{completionTokens.toLocaleString()}</div>
                                    <div className="text-[11px] text-pink-600 font-medium mt-1 whitespace-nowrap leading-tight">Completion Tokens</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">Output</div>
                                  </div>
                                )}
                                {tokensUsed !== undefined && (
                                  <div className="bg-white rounded-lg p-2.5 text-center border border-purple-300 shadow-sm ring-2 ring-purple-400">
                                    <div className="text-xl font-bold text-purple-800 whitespace-nowrap tabular-nums">{tokensUsed.toLocaleString()}</div>
                                    <div className="text-[11px] text-purple-700 font-semibold mt-1 whitespace-nowrap leading-tight">Total Tokens</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">Combined</div>
                                  </div>
                                )}
                                {duration !== null && (
                                  <div className="bg-white rounded-lg p-2.5 text-center border border-blue-200 shadow-sm">
                                    <div className="text-xl font-bold text-blue-700 whitespace-nowrap tabular-nums">{duration}s</div>
                                    <div className="text-[11px] text-blue-600 font-medium mt-1 whitespace-nowrap leading-tight">Latency</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">Response Time</div>
                                  </div>
                                )}
                              </div>
                            </div>
                            )}

                            {/* Model Configuration & Settings */}
                            {!compactIds[execution.id] && (
                            <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
                              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Model Configuration
                              </h4>
                              <div className="grid grid-cols-3 gap-3">
                                {model && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="text-xs font-medium text-gray-600 mb-1">Model</div>
                                    <div className="text-sm font-bold text-gray-900" title={model}>{model}</div>
                                  </div>
                                )}
                                {provider && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="text-xs font-medium text-gray-600 mb-1">Provider</div>
                                    <div className="text-sm font-bold text-gray-900 capitalize">{provider}</div>
                                  </div>
                                )}
                                {finishReason && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="text-xs font-medium text-gray-600 mb-1">Finish Reason</div>
                                    <div className="text-sm font-bold text-gray-900 capitalize">{finishReason.replace(/_/g, ' ')}</div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Prompt Settings/Input Parameters */}
                              {parsedInput && typeof parsedInput === 'object' && !Array.isArray(parsedInput) && (() => {
                                // Filter out array-like entries (e.g., "0", "1") and empty objects
                                const meaningfulEntries = Object.entries(parsedInput as Record<string, unknown>).filter(([key, value]) => {
                                  // Skip numeric keys (array indices)
                                  if (/^\d+$/.test(key)) return false;
                                  // Skip empty objects/arrays
                                  if (typeof value === 'object' && value !== null) {
                                    if (Array.isArray(value) && value.length === 0) return false;
                                    if (Object.keys(value).length === 0) return false;
                                  }
                                  return true;
                                });
                                return meaningfulEntries.length > 0;
                              })() && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <h5 className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                                    <svg className="w-3 h-3 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Input Parameters
                                  </h5>
                                  <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100">
                                    {Object.entries(parsedInput as Record<string, unknown>)
                                      .filter(([key, value]) => {
                                        // Filter logic (same as above)
                                        if (/^\d+$/.test(key)) return false;
                                        if (typeof value === 'object' && value !== null) {
                                          if (Array.isArray(value) && value.length === 0) return false;
                                          if (Object.keys(value).length === 0) return false;
                                        }
                                        return true;
                                      })
                                      .map(([key, value]) => (
                                        <div key={key} className="px-3 py-2 flex items-start">
                                          <span className="text-xs font-semibold text-gray-700 min-w-[100px]">{key}:</span>
                                          <span className="text-xs text-gray-600 ml-2 flex-1 break-words font-mono">
                                            {typeof value === 'string' ? value : JSON.stringify(value)}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Show message when no meaningful input parameters */}
                              {(!parsedInput || typeof parsedInput !== 'object' || Array.isArray(parsedInput) || (() => {
                                const meaningfulEntries = Object.entries(parsedInput as Record<string, unknown>).filter(([key, value]) => {
                                  if (/^\d+$/.test(key)) return false;
                                  if (typeof value === 'object' && value !== null) {
                                    if (Array.isArray(value) && value.length === 0) return false;
                                    if (Object.keys(value).length === 0) return false;
                                  }
                                  return true;
                                });
                                return meaningfulEntries.length === 0;
                              })()) && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <h5 className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                                    <svg className="w-3 h-3 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Input Parameters
                                  </h5>
                                  <div className="bg-white rounded border border-gray-200 px-3 py-2">
                                    <span className="text-xs text-gray-500 italic">No input parameters provided</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            )}
                          </>
                        )}

                        {/* Error Display */}
                        {execution.error && (
                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-red-900 flex items-center">
                              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Error
                            </h3>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 max-h-60 overflow-y-auto">
                              {typeof execution.error === 'string' 
                                ? execution.error 
                                : (execution.error as Record<string, unknown>)?.message as string || JSON.stringify(execution.error, null, 2)
                              }
                            </div>
                          </div>
                        )}

                        {/* Raw JSON - Collapsible */}
                        <details className="group">
                          <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                            <span className="text-sm font-medium text-gray-700 flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              View Raw JSON Response
                            </span>
                            <svg className="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="mt-3 bg-[#0f172a] rounded-lg p-5 overflow-x-auto max-h-[600px] min-h-56 overflow-y-auto shadow-inner border border-slate-700">
                            {/* Use parsed output when available to avoid double-encoded JSON strings */}
                            <SyntaxHighlightedJSON data={output ?? execution.output ?? execution.error ?? {}} />
                          </div>
                        </details>
                      </div>
                      )}
                    </div>
                  );
              })}
            </div>
            {/* Pagination / Controls */}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setExecLimit((n) => n + 10)}
                disabled={(workflow.executions?.length || 0) <= execLimit}
                title="Load more executions"
              >
                Load more
              </button>
              <button
                type="button"
                className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => { setFilterQuery(''); setFilterStatus('ALL'); setExecLimit(10); }}
                title="Clear filters"
              >
                Clear filters
              </button>
            </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium">No executions yet</p>
              <p className="text-xs text-gray-400 mt-1">Execute this workflow to see results here</p>
            </div>
          )}
        </div>
      </div>
      {/* Fullscreen JSON Modal */}
      {jsonModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setJsonModal({ open: false })} />
          <div className="relative w-[95vw] h-[85vh] bg-[#0f172a] rounded-lg border border-slate-700 shadow-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white truncate pr-3">{jsonModal.title || 'Raw JSON'}</div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded border border-slate-500 text-slate-100 hover:bg-slate-800"
                  onClick={() => {
                    const text = JSON.stringify(jsonModal.data ?? {}, null, 2);
                    navigator.clipboard?.writeText(text);
                  }}
                >
                  Copy
                </button>
                <button
                  className="text-xs px-2 py-1 rounded border border-slate-500 text-slate-100 hover:bg-slate-800"
                  onClick={() => setJsonModal({ open: false })}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="absolute inset-x-4 top-12 bottom-4 overflow-auto rounded bg-[#0b1220] border border-slate-700 p-4">
              <SyntaxHighlightedJSON data={jsonModal.data ?? {}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}