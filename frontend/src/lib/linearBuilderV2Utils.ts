export type ExtraInputRow = { id: string; key: string; value: string; dataType?: 'string' | 'number' | 'boolean' };

// Nested structure for UI interpolation (supports dot-path via traversal)
export function parseVariableValue(
  dataType: 'string' | 'number' | 'boolean' | undefined,
  raw: string,
): { value: string | number | boolean; error?: string } {
  const t = dataType ?? 'string';
  if (t === 'number') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return { value: NaN, error: 'Required number' };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return { value: NaN, error: 'Invalid number' };
    return { value: n };
  }
  if (t === 'boolean') {
    const normalized = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return { value: true };
    if (['false', '0', 'no', 'n'].includes(normalized)) return { value: false };
    // Empty string: treat as false
    if (normalized === '') return { value: false };
    // Unrecognized literal: surface an error for clarity (UI typically uses a dropdown)
    return { value: false, error: 'Invalid boolean' };
  }
  return { value: raw };
}

// Nested structure for UI interpolation (supports dot-path via traversal)
export function toPreviewInputs(extraInputs: ExtraInputRow[], textInput: string): Record<string, unknown> {
  const obj: Record<string, unknown> = { workflow: { input: textInput } };
  const wf = obj.workflow as Record<string, unknown>;
  const seen = new Set<string>(['input']);
  for (const row of extraInputs) {
    const k = row.key.trim();
    if (!k) continue;
    if (seen.has(k)) continue; // skip duplicates
    seen.add(k);
    const parsed = parseVariableValue(row.dataType ?? 'string', row.value);
    wf[k] = parsed.error ? row.value : parsed.value;
  }
  return obj;
}

// Flat structure for backend API (keys like 'workflow.input')
export function toFlattenedInputs(extraInputs: ExtraInputRow[], textInput: string): Record<string, unknown> {
  const flat: Record<string, unknown> = { 'workflow.input': textInput };
  const seen = new Set<string>(['input']);
  for (const row of extraInputs) {
    const k = row.key.trim();
    if (!k) continue;
    if (seen.has(k)) continue; // skip duplicates and reserved
    seen.add(k);
    const parsed = parseVariableValue(row.dataType ?? 'string', row.value);
    flat[`workflow.${k}`] = parsed.error ? row.value : parsed.value;
  }
  return flat;
}

// Very small mustache-like: supports {{workflow.input}}
export function interpolate(template: string, data: Record<string, unknown>): string {
  // allow hyphens in segment names: step.step-1.output.text
  return template.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_m, path) => {
    const fullKey = String(path);
    // 1) Exact flat-key match e.g., data['workflow.input']
    if (Object.prototype.hasOwnProperty.call(data, fullKey)) {
      const v = (data as Record<string, unknown>)[fullKey];
      return v != null ? String(v) : '';
    }
    // 2) Dot-path traversal against nested object
    const segments = fullKey.split('.');
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
}

export function recalcDupKeys(rows: Array<ExtraInputRow>): string | null {
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
}

// Extract referenced step output variable tokens from a template
export function extractStepOutputRefs(template: string): string[] {
  const refs: string[] = [];
  template.replace(/{{\s*(step\.([A-Za-z0-9_-]+)\.output\.text)\s*}}/g, (_m, full) => {
    const parts = full.split('.');
    if (parts.length >= 4) {
      refs.push(parts[1]); // stepId
    }
    return '';
  });
  return refs;
}

export type StepLike = { id: string; name?: string };
export type TimelineEntryLike = { stepId: string; status: 'pending'|'running'|'success'|'error'; output?: { text?: string } | string | null };

// Build read-only variable list for inspector after preview
export function buildStepOutputVariableList(steps: StepLike[], timeline: TimelineEntryLike[]): Array<{ key: string; label: string; stepId: string; order: number }>{
  const byId: Record<string, { index: number; name?: string }> = {};
  steps.forEach((s, i) => { byId[s.id] = { index: i, name: s.name }; });
  const list: Array<{ key: string; label: string; stepId: string; order: number }> = [];
  for (const t of timeline) {
    if (t.output == null) continue;
    const text = typeof t.output === 'object' && t.output && 'text' in t.output ? (t.output as { text?: string }).text : String(t.output);
    if (text == null) continue;
    const meta = byId[t.stepId];
    if (!meta) continue;
    const order = meta.index + 1;
    const key = `step.${t.stepId}.output.text`;
    const label = `#${order} ${(byId[t.stepId].name ?? t.stepId)} → text`;
    list.push({ key, label, stepId: t.stepId, order });
  }
  return list;
}

// Build a data map of step outputs to be used in interpolate
export function buildOutputsDataMap(timeline: TimelineEntryLike[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const nested: Record<string, unknown> = {};
  for (const t of timeline) {
    if (t.output == null) continue;
    const text = typeof t.output === 'object' && t.output && 'text' in t.output ? (t.output as { text?: string }).text : String(t.output);
    if (text == null) continue;
    const flatKey = `step.${t.stepId}.output.text`;
    data[flatKey] = text;
    if (!nested.step) nested.step = {};
    const stepObj = (nested.step as Record<string, unknown>);
    if (!stepObj[t.stepId]) stepObj[t.stepId] = {};
    const sObj = stepObj[t.stepId] as Record<string, unknown>;
    if (!sObj.output) sObj.output = {};
    (sObj.output as Record<string, unknown>).text = text;
  }
  // Merge nested into flat map under 'step'
  if (nested.step) {
    data.step = nested.step;
  }
  return data;
}

export function resolveOutputReference(dataMap: Record<string, unknown>, variableKey: string): string {
  if (Object.prototype.hasOwnProperty.call(dataMap, variableKey)) {
    const v = dataMap[variableKey];
    return v != null ? String(v) : '';
  }
  // fallback to nested walk
  const segments = variableKey.split('.');
  let cur: unknown = dataMap;
  for (const s of segments) {
    if (cur && typeof cur === 'object' && s in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return '';
    }
  }
  return cur != null ? String(cur) : '';
}
