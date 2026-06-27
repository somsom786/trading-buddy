import { describe, expect, it } from 'vitest';
import { conversationModePrompt, detectConversationMode } from './conversationMode';

describe('conversation mode', () => {
  it.each([
    ['Please just listen, no advice.', 'listen'],
    ['Can you reflect this back to me?', 'reflect'],
    ['Help me make a plan for tomorrow.', 'plan'],
    ['Let us hang out and chill.', 'hang_out'],
    ['Just sit nearby for a while.', 'presence'],
  ] as const)('detects %s', (input, expected) => {
    expect(detectConversationMode(input).mode).toBe(expected);
  });

  it('defaults to reflection and emits inspectable instructions', () => {
    const detected = detectConversationMode('FarmTown is on my mind.');
    expect(detected).toEqual({ mode: 'reflect', reasonCode: 'default_reflection' });
    expect(conversationModePrompt(detected)).toContain('Reason: default_reflection');
  });
});
