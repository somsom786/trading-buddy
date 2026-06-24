import { describe, expect, it } from 'vitest';
import { detectMemoryIntent } from './intent';

describe('detectMemoryIntent', () => {
  it('detects explicit remember requests', () => {
    expect(detectMemoryIntent('Remember that I prefer direct feedback.')).toEqual({
      type: 'remember_explicit',
      content: 'I prefer direct feedback.',
    });
  });

  it('detects explicit forget requests', () => {
    expect(detectMemoryIntent('Forget that I trade after midnight.')).toEqual({
      type: 'forget_explicit',
      query: 'I trade after midnight.',
    });
  });

  it('detects memory listing and opt-out commands', () => {
    expect(detectMemoryIntent('What do you remember about trading style?')).toEqual({
      type: 'list_memories',
      query: 'trading style',
    });
    expect(detectMemoryIntent('Do not remember this conversation.')).toEqual({
      type: 'disable_memory_for_conversation',
    });
  });
});
