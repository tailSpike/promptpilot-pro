import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  output?: { text?: string } | string | null;
}

export const LinearBuilderV2: React.FC<{ workflowId?: string }>
 = ({ workflowId }) => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepState[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  // Primary input as plain text; additional variables as key/value pairs
  const [textInput, setTextInput] = useState<string>('World');
  const [extraInputs, setExtraInputs] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [dupKeyError, setDupKeyError] = useState<string | null>(null);
  const variables = useMemo(
    () => ['workflow.input', ...extraInputs.filter(v => v.key.trim().length > 0).map(v => `workflow.${v.key}`)],
    [extraInputs]
  );
  const [showDataInspector, setShowDataInspector] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  // Advanced JSON modal
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [advancedJson, setAdvancedJson] = useState<string>('');
  const [advancedJsonError, setAdvancedJsonError] = useState<string | null>(null);
  // Save controls
  const [workflowName, setWorkflowName] = useState<string>('New Workflow');
  const [saving, setSaving] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

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

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.splice(target, 0, removed);
      return next;
    });
  };

  const deleteStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const toPreviewInputs = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = { workflow: { input: textInput } };
    const wf = obj.workflow as Record<string, unknown>;
    const seen = new Set<string>(['input']);
    for (const { key, value } of extraInputs) {
      const k = key.trim();
      if (!k) continue;
      if (seen.has(k)) {
        // skip duplicates
        continue;
      }
      seen.add(k);
      wf[k] = value;
    }
    return obj;
  };

  const interpolate = (template: string, data: Record<string, unknown>) => {
    // Very small mustache-like: supports {{workflow.input}}
    return template.replace(/{{\s*([\w.]+)\s*}}/g, (_m, path) => {
      const segments = String(path).split('.');
      let cur: unknown = data;
      for (const s of segments) {
        if (cur && typeof cur === 'object' && s in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[s];
        } else {
          return '';
        }
      }
      return cur != null ? String(cur) : '';
    });
  };

  const runPreview = async (untilStepIndex?: number) => {
    // Simulate a preview call and populate timeline for UX; if workflowId exists, try API
    try {
      const inputs = toPreviewInputs();
      setTimeline(steps.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? steps.length - 1) ? 'running' : 'pending' })));
      if (workflowId) {
        await workflowsAPI.previewWorkflow(workflowId, { input: inputs, useSampleData: false, simulateOnly: false, triggerType: 'manual' });
      }
      const outputs: TimelineEntry[] = steps.map((s, i) => {
        if (i <= (untilStepIndex ?? steps.length - 1)) {
          const content = s.config.promptContent ?? '';
          const bound = s.binding ? interpolate(`{{${s.binding}}}`, inputs) : '';
          const text = interpolate(content, inputs) || bound || '[no output]';
          return { stepId: s.id, status: 'success', output: { text } };
        }
        return { stepId: s.id, status: 'pending' };
      });
      setTimeline(outputs);
    } catch {
      setTimeline(steps.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? steps.length - 1) ? 'error' : 'pending' })));
    }
  };

  const rerunStep = async (index: number) => runPreview(index);

  // Execute (Run) using backend endpoint; requires workflowId
  const runExecute = async () => {
    if (!workflowId) return;
    try {
      setRunStatus('running');
      const inputs = toPreviewInputs();
      await workflowsAPI.executeWorkflow(workflowId, inputs, 'manual');
      setRunStatus('success');
    } catch {
      setRunStatus('error');
    }
  };

  // Duplicate key detection and guards
  const recalcDupKeys = (rows: Array<{ id: string; key: string; value: string }>) => {
    const seen = new Set<string>();
    seen.add('input'); // reserved primary key
    for (const r of rows) {
      const k = r.key.trim();
      if (!k) continue;
      if (seen.has(k)) {
        return `Duplicate variable key: ${k}`;
      }
      if (k === 'input') {
        return 'The key "input" is reserved for workflow.input';
      }
      seen.add(k);
    }
    return null;
  };

  return (
    <div className="w-full" data-testid="builder-v2-linear">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Save controls */}
        <input
          className="px-2 py-1 border rounded text-sm"
          placeholder="Workflow name"
          data-testid="workflow-name-input"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
        />
        <button
          className="px-2 py-1 border rounded"
          data-testid="save-workflow"
          disabled={saving || !workflowName.trim() || steps.length === 0}
          onClick={async () => {
            try {
              setSaving(true);
              // Create new workflow when no id; otherwise update name only
              const name = workflowName.trim();
              let id = workflowId;
              if (!id) {
                const created = await workflowsAPI.createWorkflow({ name, description: '', isActive: true });
                id = created.id ?? created?.data?.id ?? created?.workflow?.id;
              } else {
                await workflowsAPI.updateWorkflow(id, { name });
              }
              if (!id) throw new Error('Failed to resolve workflow id after save');
              // Persist steps: create sequentially
              for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                await workflowsAPI.createStep(id, {
                  name: s.name || `${s.type} ${i + 1}`,
                  type: 'PROMPT',
                  order: i + 1,
                  config: { promptContent: s.config.promptContent ?? '' },
                });
              }
              // Navigate to workflows list for further interactions (V1/V2)
              navigate('/workflows');
            } catch (e) {
              console.error('Save workflow failed', e);
              alert('Failed to save workflow. See console for details.');
            } finally {
              setSaving(false);
            }
          }}
        >{saving ? 'Saving…' : 'Save Workflow'}</button>
        <button className="px-2 py-1 border rounded" data-testid="add-step" onClick={() => setShowTypeChooser(true)}>Add Step</button>
        {showDataInspector ? null : (
          <button className="px-2 py-1 border rounded" data-testid="data-inspector-toggle" onClick={() => setShowDataInspector(true)}>Data</button>
        )}
        <button className="px-2 py-1 border rounded" data-testid="preview-run" onClick={() => runPreview() } disabled={!isValid || !!dupKeyError}>Preview</button>
        <button
          className="px-2 py-1 border rounded"
          data-testid="run-workflow"
          onClick={runExecute}
          disabled={!workflowId || !isValid || !!dupKeyError}
          title={workflowId ? '' : 'Save workflow first to enable Run'}
        >Run</button>
        {runStatus !== 'idle' ? (
          <span className={`text-xs ${runStatus === 'success' ? 'text-green-700' : runStatus === 'error' ? 'text-red-700' : 'text-gray-600'}`}>
            {runStatus === 'running' ? 'Running…' : runStatus === 'success' ? 'Run submitted' : 'Run failed'}
          </span>
        ) : null}
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
          {steps.map((step, idx) => (
            <div key={step.id} className="border rounded p-3" data-testid="step-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    aria-label="Step name"
                    value={step.name}
                    onChange={(e) => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, name: e.target.value } : s))}
                  />
                  <span className="text-xs text-gray-500">{step.type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="px-2 py-1 border rounded text-xs" disabled={idx === 0} onClick={() => moveStep(idx, -1)}>▲</button>
                  <button className="px-2 py-1 border rounded text-xs" disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 1)}>▼</button>
                  <button className="px-2 py-1 border rounded text-xs text-red-700" onClick={() => deleteStep(idx)}>Delete</button>
                </div>
              </div>
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
              <div className="text-xs mb-1">Input (workflow.input)</div>
              <textarea
                className="w-full border rounded p-2 text-xs"
                rows={6}
                data-testid="data-inspector-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <div className="text-xs font-semibold mt-2 mb-1">Additional variables</div>
              <div className="space-y-2">
                {extraInputs.map((v) => (
                  <div className="flex items-center gap-1" key={v.id} data-testid="data-inspector-var-row">
                    <input
                      className={`border rounded px-2 py-1 text-xs w-20 ${dupKeyError ? 'border-red-400' : ''}`}
                      placeholder="key"
                      value={v.key}
                      onChange={(e) => {
                        const next = extraInputs.map(x => x.id === v.id ? { ...x, key: e.target.value } : x);
                        const err = recalcDupKeys(next);
                        setDupKeyError(err);
                        setExtraInputs(next);
                      }}
                    />
                    <input
                      className="border rounded px-2 py-1 text-xs flex-1"
                      placeholder="value"
                      value={v.value}
                      onChange={(e) => setExtraInputs(prev => prev.map(x => x.id === v.id ? { ...x, value: e.target.value } : x))}
                    />
                    <button className="px-2 py-1 border rounded text-xs" onClick={() => setExtraInputs(prev => prev.filter(x => x.id !== v.id))}>×</button>
                  </div>
                ))}
              </div>
              {dupKeyError ? <div className="text-xs text-red-600 mt-1">{dupKeyError}</div> : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="px-2 py-1 border rounded text-xs"
                  disabled={!!dupKeyError}
                  onClick={() => setExtraInputs(prev => [...prev, { id: `var-${Date.now()}-${prev.length}`, key: '', value: '' }])}
                >Add variable</button>
                <button className="px-2 py-1 border rounded text-xs" onClick={() => {
                  // Open advanced JSON modal prefilled with composed inputs
                  const json = JSON.stringify(toPreviewInputs(), null, 2);
                  setAdvancedJson(json);
                  setAdvancedJsonError(null);
                  setShowAdvancedJson(true);
                }}>Advanced JSON…</button>
              </div>
              <div className="text-xs mt-2">Outputs will show in the timeline after Preview.</div>
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
                {t.output != null ? (
                  <div
                    className="text-xs text-gray-600 truncate max-w-[320px]"
                    title={typeof t.output === 'object' ? JSON.stringify(t.output) : String(t.output)}
                  >
                    {typeof t.output === 'object' && 'text' in (t.output as object)
                      ? String((t.output as { text?: string }).text ?? '')
                      : String(t.output)}
                  </div>
                ) : null}
                <button className="px-2 py-1 border rounded text-xs" data-testid="timeline-run-to-here" onClick={() => runPreview(i)}>Run to here</button>
                <button className="px-2 py-1 border rounded text-xs" data-testid="timeline-rerun-step" onClick={() => rerunStep(i)}>Re-run step</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced JSON Modal */}
      {showAdvancedJson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="data-inspector-advanced-modal">
          <div className="bg-white rounded shadow-lg w-[720px] max-w-[95vw] p-4">
            <div className="text-sm font-semibold mb-2">Advanced Inputs (JSON)</div>
            <textarea
              className="w-full border rounded p-2 text-xs font-mono"
              rows={16}
              value={advancedJson}
              onChange={(e) => setAdvancedJson(e.target.value)}
            />
            {advancedJsonError ? (
              <div className="text-xs text-red-600 mt-1">{advancedJsonError}</div>
            ) : null}
            <div className="mt-3 flex items-center gap-2 justify-end">
              <button className="px-3 py-1 border rounded text-sm" onClick={() => setShowAdvancedJson(false)} data-testid="data-inspector-advanced-cancel">Cancel</button>
              <button
                className="px-3 py-1 border rounded text-sm bg-gray-50"
                data-testid="data-inspector-advanced-save"
                onClick={() => {
                  try {
                    const obj = JSON.parse(advancedJson) as Record<string, unknown>;
                    const wf = (obj.workflow ?? {}) as Record<string, unknown>;
                    const newText = wf.input != null ? String(wf.input) : '';
                    const map = new Map<string, string>();
                    for (const [k, v] of Object.entries(wf)) {
                      if (k === 'input') continue;
                      map.set(k, v != null ? String(v) : '');
                    }
                    const entries: Array<{ id: string; key: string; value: string }> = Array.from(map.entries()).map(([k, v]) => ({ id: `var-${k}`, key: k, value: v }));
                    setTextInput(newText);
                    setExtraInputs(entries);
                    setDupKeyError(recalcDupKeys(entries));
                    setAdvancedJsonError(null);
                    setShowAdvancedJson(false);
                  } catch {
                    setAdvancedJsonError('Invalid JSON');
                  }
                }}
              >Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LinearBuilderV2;
