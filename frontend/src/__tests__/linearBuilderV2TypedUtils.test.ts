import { describe, it, expect } from 'vitest';
import { parseVariableValue, buildStepOutputVariableList, resolveOutputReference, buildOutputsDataMap, recalcDupKeys } from '../lib/linearBuilderV2Utils';

describe('linearBuilderV2 typed utils', () => {
  it('parseVariableValue coerces string/number/boolean and flags invalid number', () => {
    expect(parseVariableValue('string', 'abc').value).toBe('abc');
    expect(parseVariableValue('number', '42').value).toBe(42);
    expect(parseVariableValue('number', 'foo').error).toBeTruthy();
    expect(parseVariableValue('boolean', 'true').value).toBe(true);
    expect(parseVariableValue('boolean', '1').value).toBe(true);
    expect(parseVariableValue('boolean', 'no').value).toBe(false);
  });

  it('buildStepOutputVariableList produces stable stepId-based keys and labels', () => {
    const steps = [ { id: 's1', name: 'Step A' }, { id: 's2', name: 'Step B' } ];
    const timeline = [
      { stepId: 's1', status: 'success' as const, output: { text: 'A out' } },
      { stepId: 's2', status: 'success' as const, output: { text: 'B out' } },
    ];
    const list = buildStepOutputVariableList(steps, timeline);
    expect(list.map(l => l.key)).toEqual(['step.s1.output.text', 'step.s2.output.text']);
    expect(list[0].label).toContain('#1');
    expect(list[1].label).toContain('#2');
  });

  it('resolveOutputReference returns text for existing outputs and empty for missing', () => {
    const timeline = [ { stepId: 's1', status: 'success' as const, output: { text: 'A out' } } ];
    const map = buildOutputsDataMap(timeline);
    expect(resolveOutputReference(map, 'step.s1.output.text')).toBe('A out');
    expect(resolveOutputReference(map, 'step.s2.output.text')).toBe('');
  });

  it('recalcDupKeys works with typed rows', () => {
    expect(recalcDupKeys([{ id: '1', key: 'topic', value: 'a', dataType: 'string' }, { id: '2', key: 'topic', value: 'b', dataType: 'number' }])).toMatch(/Duplicate variable key/i);
    expect(recalcDupKeys([{ id: '1', key: 'a', value: '1', dataType: 'number' }, { id: '2', key: 'b', value: '2', dataType: 'number' }])).toBeNull();
  });
});
