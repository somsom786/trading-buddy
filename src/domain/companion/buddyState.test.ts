import { describe, expect, it } from 'vitest';
import { buddyStateForLifecycle } from './buddyState';

describe('buddyStateForLifecycle', () => {
  it.each([
    ['input_started', 'listening'],
    ['message_submitted', 'thinking'],
    ['response_started', 'talking'],
    ['generation_completed', 'idle'],
    ['generation_cancelled', 'idle'],
    ['provider_unavailable', 'concerned'],
    ['generation_failed', 'error'],
  ] as const)('maps %s to %s', (event, expected) => {
    expect(buddyStateForLifecycle(event)).toBe(expected);
  });
});
