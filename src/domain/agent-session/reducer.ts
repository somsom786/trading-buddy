import { classifyAgentEvent } from './deduplication';
import type { AgentStreamEvent } from './events';
import { MAX_AGENT_MESSAGE_LENGTH } from './protocol';
import type { AgentSessionMessage, AgentSessionSnapshot } from './types';

export type AgentSessionAction =
  | { type: 'replace_snapshot'; snapshot: AgentSessionSnapshot }
  | { type: 'stream_event'; event: AgentStreamEvent };

export function agentSessionReducer(
  snapshot: AgentSessionSnapshot,
  action: AgentSessionAction,
): AgentSessionSnapshot {
  if (action.type === 'replace_snapshot') {
    return action.snapshot.lastSequence < snapshot.lastSequence ? snapshot : action.snapshot;
  }
  const disposition = classifyAgentEvent(snapshot, action.event);
  if (disposition !== 'accept') {
    return {
      ...snapshot,
      diagnostics: {
        ...snapshot.diagnostics,
        duplicateEventCount:
          snapshot.diagnostics.duplicateEventCount +
          (disposition === 'duplicate' || disposition === 'after_terminal' ? 1 : 0),
        staleEventCount:
          snapshot.diagnostics.staleEventCount + (disposition === 'stale_request' ? 1 : 0),
      },
    };
  }
  return reduceAcceptedEvent(snapshot, action.event);
}

function reduceAcceptedEvent(
  snapshot: AgentSessionSnapshot,
  event: AgentStreamEvent,
): AgentSessionSnapshot {
  const common = {
    ...snapshot,
    lastSequence: event.sequence,
  };
  switch (event.type) {
    case 'accepted':
      return {
        ...common,
        activeRequestId: event.requestId,
        activeTurnId: event.turnId,
        turnStatus: 'submitting',
        recoverableError: null,
      };
    case 'listening':
      return { ...common, turnStatus: 'listening' };
    case 'thinking':
      return { ...common, turnStatus: 'thinking' };
    case 'content_delta':
      return {
        ...common,
        turnStatus: 'streaming',
        messages: appendAssistantDelta(snapshot.messages, event.requestId, event.content ?? ''),
      };
    case 'completed':
      return terminalSnapshot(common, event.requestId, 'completed');
    case 'cancelled':
      return terminalSnapshot(common, event.requestId, 'cancelled');
    case 'failed':
      return {
        ...terminalSnapshot(common, event.requestId, 'failed'),
        recoverableError: event.error ?? null,
      };
    case 'connection_lost':
      return {
        ...common,
        connectionStatus: 'reconnecting',
        recoverableError: {
          code: 'request_interrupted',
          userMessage: 'Buddy lost the local agent connection. Your message was not resubmitted.',
          retryable: true,
        },
        diagnostics: {
          ...snapshot.diagnostics,
          reconnectCount: snapshot.diagnostics.reconnectCount + 1,
        },
      };
    case 'connection_restored':
      return { ...common, connectionStatus: 'ready' };
  }
}

function terminalSnapshot(
  snapshot: AgentSessionSnapshot,
  requestId: string,
  status: 'completed' | 'cancelled' | 'failed',
): AgentSessionSnapshot {
  return {
    ...snapshot,
    activeRequestId: null,
    activeTurnId: null,
    turnStatus: status,
    messages: snapshot.messages.map((message) =>
      message.role === 'assistant' &&
      message.requestId === requestId &&
      (message.status === 'pending' || message.status === 'streaming')
        ? { ...message, status }
        : message,
    ),
  };
}

function appendAssistantDelta(
  messages: AgentSessionMessage[],
  requestId: string,
  delta: string,
): AgentSessionMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant' || message.requestId !== requestId) {
      return message;
    }
    const remaining = Math.max(0, MAX_AGENT_MESSAGE_LENGTH - message.content.length);
    return {
      ...message,
      content: message.content + delta.slice(0, remaining),
      status: 'streaming',
    };
  });
}
