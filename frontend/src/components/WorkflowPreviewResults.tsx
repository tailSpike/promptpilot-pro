export interface WorkflowPreviewStepResult {
  stepId: string;
  name: string;
  type: string;
  order: number;
  startedAt: string;
  durationMs: number;
  inputSnapshot: Record<string, unknown>;
  output?: Record<string, unknown> | null;
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
  input: Record<string, unknown>;
  finalOutput: Record<string, unknown> | null;
  totalDurationMs: number;
  stepResults: WorkflowPreviewStepResult[];
  stats: {
    stepsExecuted: number;
    tokensUsed: number;
  };
  warnings: string[];
}

interface WorkflowPreviewResultsProps {
  preview: WorkflowPreviewResult;
  onClear?: () => void;
}

const formatDuration = (ms: number) => {
  if (ms > 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(0)}ms`;
};

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) {
    return 'null';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export default function WorkflowPreviewResults({ preview, onClear }: WorkflowPreviewResultsProps) {
  const statusClass = preview.status === 'COMPLETED'
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-4" data-testid="workflow-preview-results">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-3">
            Test Run Summary
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}>
              {preview.status}
            </span>
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {preview.usedSampleData
              ? 'Inputs were auto-filled with sample data.'
              : 'Inputs were provided manually.'}
          </p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
          >
            Clear preview
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border border-gray-200 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Total duration</dt>
          <dd className="mt-1 text-lg font-semibold text-gray-900">{formatDuration(preview.totalDurationMs)}</dd>
        </div>
        <div className="rounded-md border border-gray-200 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Steps executed</dt>
          <dd className="mt-1 text-lg font-semibold text-gray-900">{preview.stats.stepsExecuted}</dd>
        </div>
        <div className="rounded-md border border-gray-200 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Estimated tokens</dt>
          <dd className="mt-1 text-lg font-semibold text-gray-900">{preview.stats.tokensUsed}</dd>
        </div>
      </div>

      {preview.warnings.length > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">Warnings</h4>
          <ul className="list-disc list-inside text-sm text-yellow-900 space-y-1">
            {preview.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Final output</h4>
        <pre className="bg-gray-900 text-green-200 text-xs rounded-md p-4 overflow-auto" data-testid="workflow-preview-final-output">
          {formatJson(preview.finalOutput)}
        </pre>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Step breakdown</h4>
        {preview.stepResults.map((step) => (
          <details key={step.stepId} className="rounded-md border border-gray-200">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                  {step.order + 1}
                </span>
                <span>{step.name} · <span className="text-gray-500">{step.type}</span></span>
              </span>
              <span className="text-xs text-gray-500">{formatDuration(step.durationMs)}</span>
            </summary>
            <div className="px-4 pb-4 space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h5 className="font-semibold text-gray-700 mb-1">Input snapshot</h5>
                  <pre className="bg-gray-50 border border-gray-200 rounded-md text-xs p-3 overflow-auto">
                    {formatJson(step.inputSnapshot)}
                  </pre>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-700 mb-1">Output</h5>
                  <pre className="bg-gray-50 border border-gray-200 rounded-md text-xs p-3 overflow-auto">
                    {formatJson(step.output)}
                  </pre>
                </div>
              </div>

              {typeof step.tokensUsed === 'number' && (
                <p className="text-xs text-gray-500">Estimated tokens: {step.tokensUsed}</p>
              )}

              {step.error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <h5 className="text-xs font-semibold text-red-800 mb-1">Error</h5>
                  <p className="text-xs text-red-700">{step.error.message}</p>
                  {step.error.stack && (
                    <pre className="mt-2 text-[10px] text-red-600 whitespace-pre-wrap">{step.error.stack}</pre>
                  )}
                </div>
              )}

              {step.warnings.length > 0 && (
                <ul className="list-disc list-inside text-xs text-yellow-700">
                  {step.warnings.map((warning, idx) => (
                    <li key={`${step.stepId}-warning-${idx}`}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}

        {preview.stepResults.length === 0 && (
          <p className="text-sm text-gray-500">No steps were executed in this preview run.</p>
        )}
      </section>
    </div>
  );
}
