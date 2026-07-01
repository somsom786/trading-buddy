import { describe, expect, it } from 'vitest';
import { agentMessageToChatMessage, buildHiddenCompanionContext } from './presentation';

describe('agent-session presentation', () => {
  it('maps the shared transcript into the existing project-owned message presentation', () => {
    expect(
      agentMessageToChatMessage({
        id: 'message-1',
        role: 'assistant',
        content: 'Still here.',
        createdAt: '2026-07-01T12:00:00.000Z',
        status: 'completed',
      }),
    ).toMatchObject({ role: 'assistant', content: 'Still here.', status: 'completed' });
  });

  it('keeps hidden context bounded by UTF-8 bytes', () => {
    const context = buildHiddenCompanionContext(['memory', '\u{1F331}'.repeat(10_000)]);
    expect(new TextEncoder().encode(context).byteLength).toBeLessThanOrEqual(12_000);
    expect(context.startsWith('memory')).toBe(true);
  });
});
