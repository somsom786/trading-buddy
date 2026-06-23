import { describe, expect, it } from 'vitest';
import { isLocalChatEvent, isLocalModelList } from './types';

describe('local AI boundary validation', () => {
  it('accepts valid model lists and stream events', () => {
    expect(isLocalModelList([{ name: 'qwen3:4b', sizeBytes: 123 }])).toBe(true);
    expect(
      isLocalChatEvent({
        type: 'failed',
        requestId: 'request-1',
        error: {
          code: 'generation_failed',
          userMessage: 'Failed',
          retryable: true,
        },
      }),
    ).toBe(true);
  });

  it('rejects malformed boundary payloads', () => {
    expect(isLocalModelList([{ sizeBytes: 'huge' }])).toBe(false);
    expect(isLocalChatEvent({ type: 'content_delta', requestId: 1, content: 'x' })).toBe(false);
  });
});
