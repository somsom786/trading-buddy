import { describe, expect, it } from 'vitest';
import { classifyAgentEvent } from './deduplication';
import { isAgentStreamEvent, type AgentStreamEvent } from './events';
import { isAgentSessionSnapshot, MAX_AGENT_MESSAGE_LENGTH } from './protocol';
import { agentSessionReducer } from './reducer';
import { latestRetrySource } from './retry';
import { isCompanionSupportMode, supportModeLabel } from './supportMode';
import { INITIAL_AGENT_SESSION_SNAPSHOT, type AgentSessionSnapshot } from './types';

const now = '2026-07-01T08:00:00.000Z';

function activeSnapshot(): AgentSessionSnapshot {
  return {
    ...INITIAL_AGENT_SESSION_SNAPSHOT,
    localConversationId: 'conversation-1',
    hermesSessionId: 'live-1',
    hermesSessionKey: 'stored-1',
    connectionStatus: 'ready',
    turnStatus: 'submitting',
    activeRequestId: 'request-1',
    activeTurnId: 'turn-1',
    messages: [
      {
        id: 'user-1',
        role: 'user',
        content: 'Hello',
        createdAt: now,
        status: 'completed',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '',
        createdAt: now,
        status: 'pending',
        requestId: 'request-1',
        sourceUserMessageId: 'user-1',
        attempt: 1,
      },
    ],
  };
}

function event(
  type: AgentStreamEvent['type'],
  sequence: number,
  overrides: Partial<AgentStreamEvent> = {},
): AgentStreamEvent {
  return {
    sessionId: 'live-1',
    requestId: 'request-1',
    turnId: 'turn-1',
    sequence,
    type,
    ...overrides,
  };
}

describe('agent session contract', () => {
  it('strictly validates bounded snapshots and events', () => {
    expect(isAgentSessionSnapshot(activeSnapshot())).toBe(true);
    expect(isAgentStreamEvent(event('content_delta', 1, { content: 'Hi' }))).toBe(true);
    expect(isAgentStreamEvent({ ...event('content_delta', 1), content: undefined })).toBe(false);
    expect(
      isAgentSessionSnapshot({
        ...activeSnapshot(),
        messages: [
          {
            ...activeSnapshot().messages[0],
            content: 'x'.repeat(MAX_AGENT_MESSAGE_LENGTH + 1),
          },
        ],
      }),
    ).toBe(false);
  });

  it('applies ordered deltas once and makes terminal events idempotent', () => {
    let snapshot = activeSnapshot();
    snapshot = agentSessionReducer(snapshot, {
      type: 'stream_event',
      event: event('content_delta', 1, { content: 'Hello' }),
    });
    snapshot = agentSessionReducer(snapshot, {
      type: 'stream_event',
      event: event('content_delta', 1, { content: 'Hello' }),
    });
    expect(snapshot.messages[1]?.content).toBe('Hello');
    expect(snapshot.diagnostics.duplicateEventCount).toBe(1);

    snapshot = agentSessionReducer(snapshot, {
      type: 'stream_event',
      event: event('completed', 2),
    });
    snapshot = agentSessionReducer(snapshot, {
      type: 'stream_event',
      event: event('completed', 3),
    });
    expect(snapshot.messages[1]?.status).toBe('completed');
    expect(snapshot.diagnostics.duplicateEventCount).toBe(2);
  });

  it('rejects stale request events without altering content', () => {
    const snapshot = activeSnapshot();
    const stale = event('content_delta', 1, {
      requestId: 'request-old',
      content: 'duplicate',
    });
    expect(classifyAgentEvent(snapshot, stale)).toBe('stale_request');
    const next = agentSessionReducer(snapshot, { type: 'stream_event', event: stale });
    expect(next.messages[1]?.content).toBe('');
    expect(next.diagnostics.staleEventCount).toBe(1);
  });

  it('keeps support modes closed and user-facing', () => {
    expect(isCompanionSupportMode('presence')).toBe(true);
    expect(isCompanionSupportMode('execute_trade')).toBe(false);
    expect(supportModeLabel('hang_out')).toBe('Hang out');
  });

  it('finds retry metadata without duplicating the source user message', () => {
    const snapshot = {
      ...activeSnapshot(),
      activeRequestId: null,
      activeTurnId: null,
      turnStatus: 'cancelled' as const,
      messages: activeSnapshot().messages.map((message) =>
        message.role === 'assistant' ? { ...message, status: 'cancelled' as const } : message,
      ),
    };
    expect(latestRetrySource(snapshot)).toEqual({
      userMessage: snapshot.messages[0],
      previousAssistant: snapshot.messages[1],
      nextAttempt: 2,
    });
  });
});
