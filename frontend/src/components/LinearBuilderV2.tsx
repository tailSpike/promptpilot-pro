import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workflowsAPI } from '../services/api';
import { toPreviewInputs as buildPreviewInputs, toFlattenedInputs as buildFlattenedInputs, interpolate as applyInterpolation, recalcDupKeys, buildStepOutputVariableList, buildOutputsDataMap, extractStepOutputRefs, parseVariableValue } from '../lib/linearBuilderV2Utils';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

type StepType = 'PROMPT';

interface StepState {
  id: string;
  type: StepType;
  name: string;
  config: {
    promptContent?: string;
    inputs?: Record<string, unknown>;
  };
}

interface TimelineEntry {
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: { text?: string } | string | null;
}

// Minimal shape for backend execution polling
type LiveExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
type LiveExecution = {
  id?: string;
  status: LiveExecutionStatus;
  output?: unknown;
};

type StepResultEntry = {
  meta?: { id?: string; name?: string; type?: string; order?: number };
  output?: unknown;
  durationMs?: number;
  exported?: Record<string, unknown>;
};

const extractPrimaryText = (out: unknown): string | undefined => {
  if (out && typeof out === 'object') {
    const obj = out as Record<string, unknown>;
    const gt = obj['generatedText'];
    if (typeof gt === 'string') return gt;
    const t = obj['text'];
    if (typeof t === 'string') return t;
    const ot = obj['outputText'];
    if (typeof ot === 'string') return ot;
    const ref = obj['generatedTextRef'];
    if (ref && typeof ref === 'object') {
      const prev = (ref as Record<string, unknown>)['preview'];
      if (typeof prev === 'string') return prev;
    }
  }
  return undefined;
};

export const LinearBuilderV2: React.FC<{ workflowId?: string }>
 = ({ workflowId }) => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepState[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  // Keep refs to prompt content inputs to support insertion at cursor
  const promptInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Primary input as plain text; additional variables as key/value pairs
  const [textInput, setTextInput] = useState<string>('World');
  const [extraInputs, setExtraInputs] = useState<Array<{ id: string; key: string; value: string; dataType?: 'string' | 'number' | 'boolean'; error?: string }>>([]);
  const [dupKeyError, setDupKeyError] = useState<string | null>(null);
  const variables = useMemo(
    () => ['workflow.input', ...extraInputs.filter(v => v.key.trim().length > 0).map(v => `workflow.${v.key}`)],
    [extraInputs]
  );
  const [showDataInspector, setShowDataInspector] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [stepOutputVars, setStepOutputVars] = useState<Array<{ key: string; label: string; stepId: string; order: number }>>([]);
  const [forwardRefInvalidSteps, setForwardRefInvalidSteps] = useState<Set<string>>(new Set());
  // Advanced JSON modal
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [advancedJson, setAdvancedJson] = useState<string>('');
  const [advancedJsonError, setAdvancedJsonError] = useState<string | null>(null);
  // Save controls
  const [workflowName, setWorkflowName] = useState<string>('New Workflow');
  const [saving, setSaving] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const { isEnabled: isFlagEnabled } = useFeatureFlags();
    const runInlineEnabled = isFlagEnabled('workflow.run.inline');
    const [liveExecutionId, setLiveExecutionId] = useState<string | null>(null);
    const livePollRef = useRef<number | null>(null);

  const hasTypeErrors = useMemo(() => extraInputs.some(r => r.error), [extraInputs]);
  // Disable actions when forward-reference invalids exist
  const hasForwardRefErrors = useMemo(() => forwardRefInvalidSteps.size > 0, [forwardRefInvalidSteps]);
  const isValid = useMemo(() => steps.every(s => !!(s.config.promptContent && s.config.promptContent.trim().length > 0)), [steps]);

  const [showTypeChooser, setShowTypeChooser] = useState(false);

  // When editing an existing workflow, hydrate from backend so steps are available post-redirect
  useEffect(() => {
    let active = true;
    (async () => {
      if (!workflowId) return;
      try {
        const wf = await workflowsAPI.getWorkflow(workflowId);
        if (!active || !wf) return;
        setWorkflowName(wf.name || 'Workflow');
        // Hydrate Additional variables from backend workflow variables (persisted on Save)
        try {
          type VarDto = { name?: string; type?: string; dataType?: 'string'|'number'|'boolean'|'array'|'object'; defaultValue?: unknown };
          const vars: VarDto[] = Array.isArray(wf.variables) ? wf.variables : [];
          const pickDataType = (v: VarDto): 'string'|'number'|'boolean' => {
            if (v.dataType === 'boolean' || v.dataType === 'number' || v.dataType === 'string') return v.dataType;
            const raw = v.defaultValue;
            return (typeof raw === 'boolean' ? 'boolean' : typeof raw === 'number' ? 'number' : 'string');
          };
          const toRow = (v: VarDto, idx: number) => {
            const full = String(v?.name || '');
            return {
              id: `var-${full}-${idx}`,
              key: full.replace(/^workflow\./, ''),
              value: v?.defaultValue != null ? String(v.defaultValue) : '',
              dataType: pickDataType(v),
            } as { id: string; key: string; value: string; dataType: 'string'|'number'|'boolean' };
          };
          const extras = vars
            .filter(v => String(v?.name || '').startsWith('workflow.') && String(v?.name || '') !== 'workflow.input')
            .map(toRow);
          setExtraInputs(extras);
          setDupKeyError(recalcDupKeys(extras));
        } catch { /* ignore */ }
        type BackendStep = { id?: string; order?: number; name?: string; config?: unknown };
        const parseConfig = (cfg: unknown): { promptContent?: string } => {
          const pick = (obj: Record<string, unknown>): { promptContent?: string } => ({
            promptContent: typeof obj.promptContent === 'string' ? obj.promptContent : undefined,
          });
          if (!cfg) return {};
          if (typeof cfg === 'string') {
            try {
              const parsed: unknown = JSON.parse(cfg);
              if (parsed && typeof parsed === 'object') {
                return pick(parsed as Record<string, unknown>);
              }
            } catch { /* noop */ }
            return {};
          }
          if (typeof cfg === 'object') {
            return pick(cfg as Record<string, unknown>);
          }
          return {};
        };
        const mapped: StepState[] = Array.isArray(wf.steps)
          ? (wf.steps as unknown as BackendStep[]).map((s, i: number) => {
              const cfg = parseConfig(s?.config);
              const pc = cfg?.promptContent ?? '';
              return {
                id: s.id || `step-${s.order ?? i + 1}`,
                type: 'PROMPT',
                name: s.name || `PROMPT ${i + 1}`,
                config: { promptContent: pc },
              } as StepState;
            })
          : [];
        if (mapped.length > 0) {
          setSteps(mapped);
        }
      } catch (e) {
        // Non-fatal; remain with local state
        console.warn('LinearBuilderV2: failed to hydrate workflow', e);
      }
    })();
    return () => { active = false; };
  }, [workflowId]);

  const DEFAULT_PROMPT_TEMPLATE = 'Hello {{workflow.input}}';
  const addStep = (type: StepType) => {
    const id = `step-${steps.length + 1}`;
    setSteps(prev => ([
      ...prev,
      { id, type, name: `${type} ${prev.length + 1}`, config: { promptContent: DEFAULT_PROMPT_TEMPLATE } },
    ]));
    setShowTypeChooser(false);
  };

  const handlePromptContentChange = (stepId: string, value: string) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, config: { ...s.config, promptContent: value } } : s));
  };

  const onSelectPromptField = (stepId: string) => {
    setSelectedField(`promptContent:${stepId}`);
  };

  // Insert variable token into currently selected prompt content input
  const onBindVariable = (variable: string) => {
    if (!selectedField) return;
    const [, stepId] = selectedField.split(':');
    setSteps(prev => prev.map(s => {
      if (s.id !== stepId) return s;
      const current = s.config.promptContent ?? '';
      const token = `{{${variable}}}`;
      // Avoid duplicate insertion if token already present
      if (current.includes(token)) return s;
      // Insert at cursor position if we have a ref; otherwise append
      const inputEl = promptInputRefs.current[stepId] ?? null;
      if (inputEl && typeof inputEl.selectionStart === 'number' && typeof inputEl.selectionEnd === 'number') {
        const start = inputEl.selectionStart ?? current.length;
        const end = inputEl.selectionEnd ?? start;
        const before = current.slice(0, start);
        const after = current.slice(end);
        const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
        const needsSpaceAfter = after.length > 0 && !after.startsWith(' ');
        const nextContent = `${before}${needsSpaceBefore ? ' ' : ''}${token}${needsSpaceAfter ? ' ' : ''}${after}`;
        return { ...s, config: { ...s.config, promptContent: nextContent } };
      } else {
        const sep = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
        const nextContent = current + sep + token;
        return { ...s, config: { ...s.config, promptContent: nextContent } };
      }
    }));
    // Auto-add variable rows for any new workflow.<key> references (except workflow.input)
    setExtraInputs(prev => {
      const existingKeys = new Set(prev.map(v => v.key));
      const needed: typeof prev = [];
      if (variable.startsWith('workflow.') && variable !== 'workflow.input') {
        const key = variable.replace(/^workflow\./, '');
        if (!existingKeys.has(key)) {
          needed.push({ id: `var-${key}`, key, value: '', dataType: 'string' });
        }
      }
      if (needed.length === 0) return prev;
      const merged = [...prev, ...needed];
      setDupKeyError(recalcDupKeys(merged));
      return merged;
    });
    setSelectedField(null);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.splice(target, 0, removed);
      // Recompute forward-ref invalids immediately on reorder
      recomputeForwardRefs(next);
      return next;
    });
  };

  const deleteStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  // Nested structure for UI interpolation (supports dot-path via traversal)
  const toPreviewInputs = (): Record<string, unknown> => buildPreviewInputs(extraInputs, textInput);

  // Flat structure for backend API (keys like 'workflow.input')
  const toFlattenedInputs = (): Record<string, unknown> => buildFlattenedInputs(extraInputs, textInput);

  const interpolate = (template: string, data: Record<string, unknown>) => applyInterpolation(template, data);

  const runPreview = async (untilStepIndex?: number) => {
    // Simulate a preview call and populate timeline for UX; if workflowId exists, try API
    try {
      // Ensure we have steps when coming back via redirect to edit
      let workingSteps = steps;
      if (workingSteps.length === 0 && workflowId) {
        try {
          const wf = await workflowsAPI.getWorkflow(workflowId);
          const parseConfig = (cfg: unknown): { promptContent?: string } => {
            const pick = (obj: Record<string, unknown>): { promptContent?: string } => ({
              promptContent: typeof obj.promptContent === 'string' ? obj.promptContent : undefined,
            });
            if (!cfg) return {};
            if (typeof cfg === 'string') {
              try {
                const parsed: unknown = JSON.parse(cfg);
                if (parsed && typeof parsed === 'object') {
                  return pick(parsed as Record<string, unknown>);
                }
              } catch { /* noop */ }
              return {};
            }
            if (typeof cfg === 'object') {
              return pick(cfg as Record<string, unknown>);
            }
            return {};
          };
          const mapped: StepState[] = Array.isArray(wf?.steps)
            ? (wf.steps as Array<{ id?: string; order?: number; name?: string; config?: unknown }>).map((s, i) => {
                const cfg = parseConfig(s?.config);
                const pc = cfg?.promptContent ?? '';
                return {
                  id: s.id || `step-${s.order ?? i + 1}`,
                  type: 'PROMPT',
                  name: s.name || `PROMPT ${i + 1}`,
                  config: { promptContent: pc },
                } as StepState;
              })
            : [];
          if (mapped.length > 0) {
            setSteps(mapped);
            workingSteps = mapped;
          }
        } catch {
          // ignore and continue with empty
        }
      }

      const inputsNested = toPreviewInputs();
      const inputsFlat = toFlattenedInputs();
      setTimeline(workingSteps.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? workingSteps.length - 1) ? 'running' : 'pending' })));
      if (workflowId) {
        await workflowsAPI.previewWorkflow(workflowId, { input: inputsFlat, useSampleData: false, simulateOnly: false, triggerType: 'manual' });
      }
      const outputs: TimelineEntry[] = [];
      for (let i = 0; i < workingSteps.length; i++) {
        const s = workingSteps[i];
        const upTo = untilStepIndex ?? workingSteps.length - 1;
        if (i <= upTo) {
          const content = s.config.promptContent ?? '';
          const outputsMap = buildOutputsDataMap(outputs);
          const data: Record<string, unknown> = { ...inputsFlat, ...inputsNested, ...outputsMap };
          const text = interpolate(content, data) || '[no output]';
          outputs.push({ stepId: s.id, status: 'success', output: { text } });
        } else {
          outputs.push({ stepId: s.id, status: 'pending' });
        }
      }
      setTimeline(outputs);
      // Build step output variables list for inspector
      const list = buildStepOutputVariableList(workingSteps, outputs);
      setStepOutputVars(list);
      // Recompute forward-ref validation based on current steps content
      recomputeForwardRefs(workingSteps);
    } catch {
      const working = steps.length > 0 ? steps : [];
      setTimeline(working.map((s, i) => ({ stepId: s.id, status: i <= (untilStepIndex ?? working.length - 1) ? 'error' : 'pending' })));
    }
  };

  const rerunStep = async (index: number) => runPreview(index);

  const recomputeForwardRefs = (currentSteps: StepState[]) => {
    const invalid = new Set<string>();
    const idToIndex = new Map<string, number>();
    currentSteps.forEach((s, i) => idToIndex.set(s.id, i));
    currentSteps.forEach((s, i) => {
      const content = s.config.promptContent ?? '';
      const refs = extractStepOutputRefs(content);
      for (const refStepId of refs) {
        const producerIndex = idToIndex.get(refStepId);
        if (producerIndex == null) continue;
        if (producerIndex >= i) {
          invalid.add(s.id);
        }
      }
    });
    setForwardRefInvalidSteps(invalid);
  };

  useEffect(() => {
    recomputeForwardRefs(steps);
  }, [steps]);

  // Execute (Run) using backend endpoint; requires workflowId
  const runExecute = async () => {
    if (!workflowId) return;
    try {
      setRunStatus('running');
      const inputsFlat = toFlattenedInputs();
      const execResp = await workflowsAPI.executeWorkflow(workflowId, inputsFlat, 'manual');
      // Prefer executionId if present; fallback to id
      const execId: string | undefined = execResp?.executionId ?? execResp?.id ?? execResp?.data?.executionId ?? execResp?.data?.id;
      setRunStatus('success');
      if (runInlineEnabled && execId) {
        setLiveExecutionId(execId);
      }
    } catch {
      setRunStatus('error');
    }
  };

  // Live execution polling → map backend execution output shape into timeline entries
  useEffect(() => {
    if (!workflowId || !liveExecutionId || !runInlineEnabled) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const exec: LiveExecution = await workflowsAPI.getWorkflowExecution(workflowId, liveExecutionId);
        if (cancelled || !exec) return;
        // exec.output may be JSON string; normalize to object
        let outputObj: Record<string, unknown> | null = null;
        if (exec.output) {
          if (typeof exec.output === 'string') {
            try { outputObj = JSON.parse(exec.output); } catch { outputObj = null; }
          } else if (typeof exec.output === 'object') {
            outputObj = exec.output as Record<string, unknown>;
          }
        }
        // Safe parse stepResults → Record<string, StepResultEntry>
        let stepResults: Record<string, StepResultEntry> = {};
        if (outputObj && typeof (outputObj as Record<string, unknown>)['stepResults'] === 'object' && (outputObj as Record<string, unknown>)['stepResults'] !== null) {
          const raw = (outputObj as Record<string, unknown>)['stepResults'] as Record<string, unknown>;
          const parsed: Record<string, StepResultEntry> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (!v || typeof v !== 'object') continue;
            const rv = v as Record<string, unknown>;
            const meta = rv['meta'];
            parsed[k] = {
              meta: (meta && typeof meta === 'object') ? (meta as StepResultEntry['meta']) : undefined,
              output: rv['output'],
            };
          }
          stepResults = parsed;
        }
        // Build timeline based on current steps and any known step outputs
  const mapped: TimelineEntry[] = steps.map((s) => {
          // In stepResults we keyed by step order when executing service (step_<order>) and meta.id holds the server step id
          const match = Object.values(stepResults).find((r) => Boolean(r?.meta?.id && r.meta!.id === s.id));
          if (match) {
            const curLowered = String(exec.status || '').toLowerCase();
            const status: TimelineEntry['status'] = curLowered === 'running' ? 'running' : (curLowered === 'failed' ? 'error' : 'success');
            const out = match.output;
            const text = extractPrimaryText(out);
            return { stepId: s.id, status: status as TimelineEntry['status'], output: text ? { text } : (out ?? null) };
          }
          // Not yet reached → pending or running if execution overall running and earlier steps done
          const curLowered = String(exec.status || '').toLowerCase();
          return { stepId: s.id, status: curLowered === 'running' ? 'running' : 'pending' };
        });
        // If failed, surface top-level error message on the first unmatched step
        const overallLowered = String(exec.status || '').toLowerCase();
        if (overallLowered === 'failed') {
          let errorMsg: string | undefined;
          const rawErrUnknown = (exec as unknown as { error?: unknown })?.error;
          if (typeof rawErrUnknown === 'string') {
            try {
              const parsed = JSON.parse(rawErrUnknown) as { message?: unknown };
              errorMsg = typeof parsed?.message === 'string' ? parsed.message : 'Execution failed';
            } catch {
              errorMsg = rawErrUnknown;
            }
          } else if (rawErrUnknown && typeof rawErrUnknown === 'object') {
            const maybeMsg = (rawErrUnknown as Record<string, unknown>)['message'];
            errorMsg = typeof maybeMsg === 'string' ? maybeMsg : 'Execution failed';
          }
          const matchedIds = new Set(Object.values(stepResults).map((r) => r?.meta?.id).filter(Boolean) as string[]);
          const firstUnmatched = steps.find((s) => !matchedIds.has(s.id));
          if (firstUnmatched && errorMsg) {
            const idx = mapped.findIndex((m) => m.stepId === firstUnmatched.id);
            if (idx >= 0) {
              mapped[idx] = { stepId: firstUnmatched.id, status: 'error', output: { text: errorMsg } };
            }
          }
        }
        setTimeline(mapped);
        // Build Step Outputs list from live data too
        const list = buildStepOutputVariableList(steps, mapped);
        setStepOutputVars(list);

        const lowered = String(exec.status || '').toLowerCase();
        const terminal = (lowered === 'completed' || lowered === 'failed' || lowered === 'cancelled');
        if (!terminal) {
          // Schedule next poll
          livePollRef.current = window.setTimeout(poll, 800);
        } else {
          livePollRef.current = null;
        }
      } catch {
        // Backoff on errors
        livePollRef.current = window.setTimeout(poll, 1500);
      }
    };
    // Kick off immediately
    poll();
    return () => {
      cancelled = true;
      if (livePollRef.current) {
        window.clearTimeout(livePollRef.current);
        livePollRef.current = null;
      }
    };
  }, [workflowId, liveExecutionId, runInlineEnabled, steps]);

  // Duplicate key detection and guards
  // recalcDupKeys imported from utils

  // Aggregate Save disabling reasons for UX (tooltip + summary + a11y)
  const saveDisabledReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!workflowName.trim()) reasons.push('Workflow name is required');
    if (steps.length === 0) reasons.push('At least one step is required');
    if (!isValid) reasons.push('All steps must have prompt content');
    if (dupKeyError) reasons.push(dupKeyError);
    if (hasTypeErrors) reasons.push('Fix invalid variable values (e.g., number/boolean)');
    if (hasForwardRefErrors) reasons.push('Resolve forward references to later step outputs');
    return reasons;
  }, [workflowName, steps.length, isValid, dupKeyError, hasTypeErrors, hasForwardRefErrors]);

  const isSaveDisabled = saving || saveDisabledReasons.length > 0;
  const saveReasonsSummary = saveDisabledReasons.join('; ');
  const saveReasonsId = 'save-disabled-reasons';

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
          type="button"
          className={`px-2 py-1 border rounded ${isSaveDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          data-testid="save-workflow"
          disabled={isSaveDisabled}
          aria-disabled={isSaveDisabled}
          aria-describedby={isSaveDisabled ? saveReasonsId : undefined}
          title={isSaveDisabled ? `Cannot save: ${saveReasonsSummary}` : ''}
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
              // Persist variables from Data Inspector first (treat as input variables)
              try {
                const toVar = (name: string, row?: { dataType?: 'string'|'number'|'boolean'; value?: string }) => {
                  if (!row) {
                    return { name, type: 'input' as const, dataType: 'string' as const, defaultValue: String(textInput ?? '') };
                  }
                  const parsed = parseVariableValue(row.dataType ?? 'string', row.value ?? '');
                  const dt = (row.dataType ?? 'string');
                  return { name, type: 'input' as const, dataType: dt, defaultValue: parsed.error ? row.value ?? '' : parsed.value };
                };
                const vars = [toVar('workflow.input'), ...extraInputs.filter(v => v.key.trim()).map(v => toVar(`workflow.${v.key.trim()}`, v))];
                await workflowsAPI.replaceVariables(id, vars);
              } catch (e) {
                console.warn('Save workflow: variables update failed (non-fatal)', e);
              }

              // When editing an existing workflow, remove existing steps to avoid unique (workflowId, order) conflicts
              try {
                const existing = await workflowsAPI.getWorkflow(id);
                const existingSteps: Array<{ id: string }> = Array.isArray(existing?.steps) ? existing.steps : [];
                for (const es of existingSteps) {
                  if (es?.id) {
                    await workflowsAPI.deleteStep(id, es.id);
                  }
                }
              } catch (e) {
                // Non-fatal: continue even if we fail to load/delete existing steps
                console.warn('Save workflow: unable to load/delete existing steps', e);
              }
              // Persist new steps sequentially with fresh ordering and remap local ids to server ids
              const idMap = new Map<string, string>(); // localId -> serverId
              const createdSteps: Array<{ localId: string; serverId: string; order: number; name: string; originalContent: string }>= [];
              for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                const promptContent = (s.config.promptContent ?? '').trim();
                const resp = await workflowsAPI.createStep(id, {
                  name: s.name || `${s.type} ${i + 1}`,
                  type: 'PROMPT',
                  order: i + 1,
                  config: { promptContent },
                });
                const serverStepId = resp?.id ?? resp?.data?.id ?? resp?.step?.id;
                if (serverStepId) {
                  idMap.set(s.id, serverStepId);
                  createdSteps.push({ localId: s.id, serverId: serverStepId, order: i + 1, name: s.name, originalContent: promptContent });
                }
              }
              // Second pass: update any tokens that reference local ids with server ids for stable references
              const replaceLocalWithServer = (content: string): string => {
                return content.replace(/{{\s*step\.([A-Za-z0-9_-]+)\.output\.text\s*}}/g, (_m, localId) => {
                  const server = idMap.get(localId);
                  const targetId = server ?? localId;
                  return `{{step.${targetId}.output.text}}`;
                });
              };
              for (const s of createdSteps) {
                const updatedContent = replaceLocalWithServer(s.originalContent);
                if (updatedContent !== s.originalContent) {
                  await workflowsAPI.updateStep(id, s.serverId, {
                    name: s.name || `PROMPT ${s.order}`,
                    type: 'PROMPT',
                    order: s.order,
                    config: { promptContent: updatedContent },
                  });
                }
              }
              // Redirect to edit route and keep V2 enabled so Run is available immediately
              navigate(`/workflows/${id}/edit?v2=1`);
            } catch (e) {
              console.error('Save workflow failed', e);
              // Surface a clearer message if available
              const err = e as unknown as { response?: { data?: { error?: string } } } | Error;
              const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error
                || (err as Error).message
                || 'Failed to save workflow. See console for details.';
              alert(message);
            } finally {
              setSaving(false);
            }
          }}
        >{saving ? 'Saving…' : 'Save Workflow'}</button>
        {isSaveDisabled && saveDisabledReasons.length > 0 ? (
          <div id={saveReasonsId} className="text-xs text-red-700" data-testid="save-disabled-reasons">
            Cannot save: {saveDisabledReasons[0]}{saveDisabledReasons.length > 1 ? ` (+${saveDisabledReasons.length - 1} more)` : ''}
          </div>
        ) : null}
        <button type="button" className="px-2 py-1 border rounded" data-testid="add-step" onClick={() => setShowTypeChooser(true)}>Add Step</button>
        {showDataInspector ? null : (
          <button type="button" className="px-2 py-1 border rounded" data-testid="data-inspector-toggle" onClick={() => setShowDataInspector(true)}>Data</button>
        )}
  <button type="button" className="px-2 py-1 border rounded" data-testid="preview-run" onClick={() => runPreview() } disabled={!isValid || !!dupKeyError || hasTypeErrors}>Preview</button>
        <button
          type="button"
          className="px-2 py-1 border rounded"
          data-testid="run-workflow"
          onClick={runExecute}
          disabled={!workflowId || !isValid || !!dupKeyError || hasTypeErrors || hasForwardRefErrors}
          title={
            !workflowId
              ? 'Save workflow first to enable Run'
              : (!runInlineEnabled ? 'Live run timeline disabled by feature flag; run will still start.' : '')
          }
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
          {stepOutputVars.length > 0 ? (
            <div className="mt-3">
              <div className="text-xs font-semibold mb-1">Step Outputs</div>
              {stepOutputVars.map((o) => (
                <div key={o.key} className="text-xs text-blue-700 cursor-pointer" data-testid={`variable-item-${o.key}`} onClick={() => onBindVariable(o.key)}>
                  {o.label}
                </div>
              ))}
            </div>
          ) : null}
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
                  <button type="button" className="px-2 py-1 border rounded text-xs" disabled={idx === 0} onClick={() => moveStep(idx, -1)}>▲</button>
                  <button type="button" className="px-2 py-1 border rounded text-xs" disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 1)}>▼</button>
                  <button type="button" className="px-2 py-1 border rounded text-xs text-red-700" onClick={() => deleteStep(idx)}>Delete</button>
                </div>
              </div>
              <div className="mb-2">
                <label className="block text-xs text-gray-600 mb-1">Prompt Content</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  data-testid="input-field-promptContent"
                  value={step.config.promptContent ?? ''}
                  onChange={(e) => handlePromptContentChange(step.id, e.target.value)}
                  onFocus={() => onSelectPromptField(step.id)}
                  ref={(el) => { promptInputRefs.current[step.id] = el; }}
                />
              </div>
              {!step.config.promptContent ? (
                <div className="text-xs text-red-600" data-testid="validation-inline">Required: prompt content</div>
              ) : null}
              {forwardRefInvalidSteps.has(step.id) ? (
                <div className="text-xs text-red-600" data-testid="output-forward-ref-warning">Invalid forward reference: refers to a later step output</div>
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
                    <select
                      className="border rounded px-1 py-1 text-xs"
                      data-testid="data-inspector-var-type"
                      value={v.dataType ?? 'string'}
                      onChange={(e) => {
                        const dt = (e.target.value as 'string'|'number'|'boolean');
                        const calcError = (dtVal: 'string'|'number'|'boolean', raw: string) => dtVal === 'number' ? parseVariableValue('number', raw).error : undefined;
                        setExtraInputs(prev => prev.map(x => x.id === v.id ? { ...x, dataType: dt, error: calcError(dt, x.value) } : x));
                      }}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
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
                    { (v.dataType ?? 'string') === 'boolean' ? (
                      <select
                        className="border rounded px-2 py-1 text-xs flex-1"
                        data-testid="data-inspector-var-value-boolean"
                        value={(v.value || '').toString().toLowerCase() === 'true' ? 'true' : 'false'}
                        onChange={(e) => setExtraInputs(prev => prev.map(x => x.id === v.id ? { ...x, value: e.target.value } : x))}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        className={`border rounded px-2 py-1 text-xs flex-1 ${(v.dataType === 'number' && v.error) ? 'border-red-400' : ''}`}
                        placeholder="value"
                        value={v.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          const err = v.dataType === 'number' ? parseVariableValue('number', val).error : undefined;
                          setExtraInputs(prev => prev.map(x => x.id === v.id ? { ...x, value: val, error: err } : x));
                        }}
                      />
                    )}
                    <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => setExtraInputs(prev => prev.filter(x => x.id !== v.id))}>×</button>
                  </div>
                ))}
              </div>
              {dupKeyError ? <div className="text-xs text-red-600 mt-1">{dupKeyError}</div> : null}
              {hasTypeErrors ? <div className="text-xs text-red-600 mt-1">Fix invalid typed variable values</div> : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs"
                  disabled={!!dupKeyError}
                  onClick={() => setExtraInputs(prev => [...prev, { id: `var-${Date.now()}-${prev.length}`, key: '', value: '', dataType: 'string' }])}
                >Add variable</button>
                <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => {
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
          <button type="button" className="px-2 py-1 border rounded" data-testid="step-type-PROMPT" onClick={() => addStep('PROMPT')}>PROMPT</button>
          <button type="button" className="px-2 py-1 border rounded" onClick={() => setShowTypeChooser(false)}>Cancel</button>
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
                <button type="button" className="px-2 py-1 border rounded text-xs" data-testid="timeline-run-to-here" onClick={() => runPreview(i)}>Run to here</button>
                <button type="button" className="px-2 py-1 border rounded text-xs" data-testid="timeline-rerun-step" onClick={() => rerunStep(i)}>Re-run step</button>
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
              <button type="button" className="px-3 py-1 border rounded text-sm" onClick={() => setShowAdvancedJson(false)} data-testid="data-inspector-advanced-cancel">Cancel</button>
              <button
                type="button"
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
                    const entries: Array<{ id: string; key: string; value: string; dataType?: 'string' | 'number' | 'boolean' }> = Array.from(map.entries()).map(([k, v]) => ({ id: `var-${k}`, key: k, value: v, dataType: 'string' }));
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
