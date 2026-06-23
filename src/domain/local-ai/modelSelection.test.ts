import { describe, expect, it } from 'vitest';
import { selectPreferredModel } from './modelSelection';

const models = [{ name: 'llama3.2:3b' }, { name: 'qwen3:4b' }];

describe('selectPreferredModel', () => {
  it('preserves a valid session selection', () => {
    expect(selectPreferredModel(models, 'llama3.2:3b')).toBe('llama3.2:3b');
  });

  it('prefers the recommended Qwen model, then the first model', () => {
    expect(selectPreferredModel(models, null)).toBe('qwen3:4b');
    expect(selectPreferredModel([{ name: 'gemma3:4b' }], null)).toBe('gemma3:4b');
    expect(selectPreferredModel([], null)).toBeNull();
  });
});
