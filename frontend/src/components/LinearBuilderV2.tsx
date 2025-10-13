import React, { useMemo, useState } from 'react';
import { workflowsAPI } from '../services/api';

type StepType = 'PROMPT';

interface StepState {
  id: string;
  type: StepType;
  name: string;
  config: {
    promptContent?: string;
    inputs?: Record<string, unknown>;
  };
  binding?: string;
}

interface TimelineEntry {
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: unknown;
}

export const LinearBuilderV2: React.FC<{ workflowId?: string }>
 = ({ workflowId }) => {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [variables] = useState<string[]>(['workflow.input']);
  const [showDataInspector, setShowDataInspector] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  const isValid = useMemo(() => steps.every(s => !!(s.config.promptContent || s.binding)), [steps]);

  const [showTypeChooser, setShowTypeChooser] = useState(false);

  const addStep = (type: StepType) => {
    const id = `step-${steps.length + 1}`;
    setSteps((prev) => ([
      ...prev,
      { id, type, name: `${type} ${prev.length + 1}`, config: { promptContent: 'Hello {{workflow.input}}' } },
    ]));
    setShowTypeChooser(false);
  };

  const onSelectPromptField = (stepId: string) => {
    setSelectedField(`promptContent:${stepId}`);
  };

  const onBindVariable = (variable: string) => {
    if (!selectedField) return;
    const [, stepId] = selectedField.split(':');
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, binding: variable } : s));
    setSelectedField(null);
  };

  const runPreview = async (untilStepIndex?: number) => {
    // Simulate a preview call and populate timeline for UX; if workflowId exists, try API
    try {
      setTimeline(steps.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? steps.length - 1) ? 'running' : 'pending' })));
      if (workflowId) {
        await workflowsAPI.previewWorkflow(workflowId, { input: {}, useSampleData: true, simulateOnly: true });
      }
      setTimeline(steps.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? steps.length - 1) ? 'success' : 'pending', output: { ok: true } })));
    } catch {
      setTimeline(steps.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? steps.length - 1) ? 'error' : 'pending' })));
    }
  };

  const rerunStep = async (index: number) => runPreview(index);

  return (
    <div className="w-full" data-testid="builder-v2-linear">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <button className="px-2 py-1 border rounded" data-testid="add-step" onClick={() => setShowTypeChooser(true)}>Add Step</button>
        {showDataInspector ? null : (
          <button className="px-2 py-1 border rounded" data-testid="data-inspector-toggle" onClick={() => setShowDataInspector(true)}>Data</button>
        )}
        <button className="px-2 py-1 border rounded" data-testid="preview-run" onClick={() => runPreview() } disabled={!isValid}>Preview</button>
      </div>

      {/* Body: Variable inspector + steps + data inspector */}
      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-3 border rounded p-2" data-testid="variable-inspector">
          <div className="text-sm font-semibold mb-2">Variables</div>
          {variables.map((v) => (
            <div key={v} className="text-sm text-blue-700 cursor-pointer" data-testid={`variable-item-${v}`} onClick={() => onBindVariable(v)}>
              {v}
            </div>
          ))}
        </aside>

        <section className="col-span-6 space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="border rounded p-3" data-testid="step-card">
              <div className="text-sm font-semibold mb-2">{step.name}</div>
              <div className="mb-2">
                <label className="block text-xs text-gray-600 mb-1">Prompt Content</label>
                <input className="w-full border rounded px-2 py-1" data-testid="input-field-promptContent" value={step.config.promptContent ?? ''} onChange={(e) => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, config: { ...s.config, promptContent: e.target.value } } : s))} onFocus={() => onSelectPromptField(step.id)} />
              </div>
              {step.binding && (
                <div className="text-xs text-gray-700" data-testid="binding-expression">{step.binding}</div>
              )}
              {!step.config.promptContent && !step.binding ? (
                <div className="text-xs text-red-600" data-testid="validation-inline">Required: prompt content or variable binding</div>
              ) : null}
            </div>
          ))}
        </section>

        <aside className="col-span-3">
          {showDataInspector && (
            <div className="border rounded p-2" data-testid="data-inspector">
              <div className="text-sm font-semibold mb-2">Data Inspector</div>
              <div className="text-xs">Inputs</div>
              <div className="text-xs">Outputs</div>
            </div>
          )}
        </aside>
      </div>

      {/* Step type chooser */}
      {showTypeChooser && (
        <div className="mb-3 p-2 border rounded bg-white shadow-sm inline-flex gap-2">
          <button className="px-2 py-1 border rounded" data-testid="step-type-PROMPT" onClick={() => addStep('PROMPT')}>PROMPT</button>
          <button className="px-2 py-1 border rounded" onClick={() => setShowTypeChooser(false)}>Cancel</button>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="mt-4 border-t pt-3" data-testid="execution-timeline">
          <div className="space-y-2">
            {timeline.map((t, i) => (
              <div key={t.stepId} className="flex items-center gap-2">
                <div className="flex-1 text-sm">{t.stepId}</div>
                <div className="text-xs" data-testid="execution-timeline-status">{t.status}</div>
                <button className="px-2 py-1 border rounded text-xs" data-testid="timeline-run-to-here" onClick={() => runPreview(i)}>Run to here</button>
                <button className="px-2 py-1 border rounded text-xs" data-testid="timeline-rerun-step" onClick={() => rerunStep(i)}>Re-run step</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LinearBuilderV2;
