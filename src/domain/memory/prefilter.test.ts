import { describe, expect, it } from 'vitest';
import { defaultMemoryPreferences } from './types';
import { decideMemoryExtraction } from './prefilter';

const base = {
  role: 'user' as const,
  temporaryChat: false,
  memoryEnabled: true,
  preferences: defaultMemoryPreferences,
};

describe('decideMemoryExtraction', () => {
  it('extracts for explicit remember and durable trading rules', () => {
    expect(
      decideMemoryExtraction({ ...base, content: 'Remember that I prefer direct feedback.' }),
    ).toEqual({ shouldExtract: true, reason: 'explicit_request' });
    expect(
      decideMemoryExtraction({ ...base, content: 'My maximum risk per trade is 1%.' }),
    ).toEqual({ shouldExtract: true, reason: 'durable_statement' });
  });

  it('extracts goals and temporary context', () => {
    expect(
      decideMemoryExtraction({ ...base, content: 'My goal is to stop revenge trading.' }),
    ).toEqual({
      shouldExtract: true,
      reason: 'goal_or_rule',
    });
    expect(decideMemoryExtraction({ ...base, content: 'I am travelling this week.' })).toEqual({
      shouldExtract: true,
      reason: 'temporary_context',
    });
  });

  it('ignores greetings, temporary chats, opt-outs, and fake secrets', () => {
    expect(decideMemoryExtraction({ ...base, content: 'hello' }).shouldExtract).toBe(false);
    expect(
      decideMemoryExtraction({ ...base, content: 'Remember this.', temporaryChat: true }),
    ).toEqual({
      shouldExtract: false,
      reason: 'temporary_chat',
    });
    expect(decideMemoryExtraction({ ...base, content: 'Do not remember this.' })).toEqual({
      shouldExtract: false,
      reason: 'user_opt_out',
    });
    expect(decideMemoryExtraction({ ...base, content: 'password: fake-password-123' })).toEqual({
      shouldExtract: false,
      reason: 'secret_detected',
    });
  });

  it('respects manual-only mode for non-explicit statements', () => {
    expect(
      decideMemoryExtraction({
        ...base,
        preferences: { ...defaultMemoryPreferences, memoryApprovalMode: 'manual_only' },
        content: 'I prefer short replies.',
      }),
    ).toEqual({ shouldExtract: false, reason: 'not_memory_worthy' });
  });
});
