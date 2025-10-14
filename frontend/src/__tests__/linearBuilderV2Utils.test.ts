import { describe, it, expect } from 'vitest';
import { toPreviewInputs, toFlattenedInputs, interpolate, recalcDupKeys } from '../lib/linearBuilderV2Utils';

describe('linearBuilderV2Utils', () => {
  it('toPreviewInputs builds nested structure and skips duplicates/reserved', () => {
    const rows = [
      { id: '1', key: 'topic', value: 'Testing' },
      { id: '2', key: 'input', value: 'SHOULD_SKIP' },
      { id: '3', key: 'topic', value: 'Dup' },
    ];
    const obj = toPreviewInputs(rows, 'World');
    expect(obj).toEqual({ workflow: { input: 'World', topic: 'Testing' } });
  });

  it('toFlattenedInputs builds flat map and skips duplicates/reserved', () => {
    const rows = [
      { id: '1', key: 'topic', value: 'Testing' },
      { id: '2', key: 'input', value: 'SHOULD_SKIP' },
      { id: '3', key: 'topic', value: 'Dup' },
    ];
    const flat = toFlattenedInputs(rows, 'World');
    expect(flat).toEqual({ 'workflow.input': 'World', 'workflow.topic': 'Testing' });
  });

  it('interpolate prefers flat keys and falls back to nested traversal', () => {
    const data = { 'workflow.input': 'Flat', workflow: { input: 'Nested', topic: 'Unit' } } as Record<string, unknown>;
    expect(interpolate('Hello {{workflow.input}}', data)).toBe('Hello Flat');
    expect(interpolate('Topic: {{workflow.topic}}', data)).toBe('Topic: Unit');
    expect(interpolate('Missing {{workflow.missing}}', data)).toBe('Missing ');
  });

  it('recalcDupKeys flags duplicates and reserved key', () => {
    // 'input' is pre-reserved and added to seen; encountering it yields duplicate message
    expect(recalcDupKeys([{ id: '1', key: 'input', value: '' }])).toMatch(/duplicate/i);
    expect(recalcDupKeys([{ id: '1', key: 'topic', value: 'a' }, { id: '2', key: 'topic', value: 'b' }])).toMatch(/Duplicate variable key/i);
    expect(recalcDupKeys([{ id: '1', key: 'a', value: '1' }, { id: '2', key: 'b', value: '2' }])).toBeNull();
  });
});
