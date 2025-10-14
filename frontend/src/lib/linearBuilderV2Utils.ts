export type ExtraInputRow = { id: string; key: string; value: string };

// Nested structure for UI interpolation (supports dot-path via traversal)
export function toPreviewInputs(extraInputs: ExtraInputRow[], textInput: string): Record<string, unknown> {
  const obj: Record<string, unknown> = { workflow: { input: textInput } };
  const wf = obj.workflow as Record<string, unknown>;
  const seen = new Set<string>(['input']);
  for (const { key, value } of extraInputs) {
    const k = key.trim();
    if (!k) continue;
    if (seen.has(k)) continue; // skip duplicates
    seen.add(k);
    wf[k] = value;
  }
  return obj;
}

// Flat structure for backend API (keys like 'workflow.input')
export function toFlattenedInputs(extraInputs: ExtraInputRow[], textInput: string): Record<string, unknown> {
  const flat: Record<string, unknown> = { 'workflow.input': textInput };
  const seen = new Set<string>(['input']);
  for (const { key, value } of extraInputs) {
    const k = key.trim();
    if (!k) continue;
    if (seen.has(k)) continue; // skip duplicates and reserved
    seen.add(k);
    flat[`workflow.${k}`] = value;
  }
  return flat;
}

// Very small mustache-like: supports {{workflow.input}}
export function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_m, path) => {
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
