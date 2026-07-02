import { vi } from 'vitest';
import {
  INITIAL_AGENT_SESSION_SNAPSHOT,
  type AgentSessionSnapshot,
} from '../domain/agent-session/types';
import type {
  AgentSessionService,
  AgentSessionSubmitRequest,
} from '../services/tauri/agentSessionService';

interface FakeAgentSessionOptions {
  responseText?: string;
  holdResponse?: boolean;
  connectionStatus?: AgentSessionSnapshot['connectionStatus'];
}

export function createFakeAgentSessionService(options: FakeAgentSessionOptions = {}) {
  let snapshot: AgentSessionSnapshot = {
    ...INITIAL_AGENT_SESSION_SNAPSHOT,
    connectionStatus: options.connectionStatus ?? 'ready',
  };
  const listeners = new Set<(value: AgentSessionSnapshot) => void>();
  let release: (() => void) | undefined;

  const publish = (next: AgentSessionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => {
      listener(next);
    });
  };

  const submit = vi.fn(async (request: AgentSessionSubmitRequest) => {
    const conversationId = request.temporary
      ? 'temporary-conversation'
      : (request.localConversationId ?? 'conversation-shared');
    const active: AgentSessionSnapshot = {
      ...snapshot,
      localConversationId: conversationId,
      hermesSessionId: 'hermes-live',
      hermesSessionKey: 'hermes-stored',
      temporary: request.temporary,
      turnStatus: 'streaming',
      activeRequestId: request.requestId,
      activeTurnId: request.turnId,
      messages: [
        {
          id: 'message-user',
          role: 'user',
          content: request.text,
          createdAt: '2026-07-01T12:00:00.000Z',
          status: 'completed',
        },
        {
          id: 'message-assistant',
          role: 'assistant',
          content: options.holdResponse ? '' : (options.responseText ?? 'Shared hello'),
          createdAt: '2026-07-01T12:00:01.000Z',
          status: options.holdResponse ? 'streaming' : 'completed',
          requestId: request.requestId,
          sourceUserMessageId: 'message-user',
          attempt: 1,
        },
      ],
    };
    publish(active);
    if (options.holdResponse) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    const completed = {
      ...active,
      turnStatus: 'completed' as const,
      activeRequestId: null,
      activeTurnId: null,
      messages: active.messages.map((message) =>
        message.role === 'assistant'
          ? {
              ...message,
              content: options.responseText ?? 'Shared hello',
              status: 'completed' as const,
            }
          : message,
      ),
    };
    publish(completed);
    return completed;
  });

  const service: AgentSessionService = {
    diagnostics: vi.fn().mockResolvedValue({
      status: 'ready',
      processId: 123,
      restartCount: 0,
      lastError: null,
    }),
    snapshot: vi.fn(() => Promise.resolve(snapshot)),
    start: vi.fn(() => Promise.resolve(snapshot)),
    retryConnection: vi.fn(() => Promise.resolve(snapshot)),
    open: vi.fn((request) => {
      const next = {
        ...snapshot,
        localConversationId: request.localConversationId,
        temporary: request.temporary,
      };
      publish(next);
      return Promise.resolve(next);
    }),
    submit,
    retry: vi.fn((request) =>
      submit({
        localConversationId: snapshot.localConversationId,
        requestId: request.requestId,
        turnId: request.turnId,
        text:
          [...snapshot.messages].reverse().find((message) => message.role === 'user')?.content ??
          'Retry',
        model: request.model,
        temporary: snapshot.temporary,
        hiddenContext: request.hiddenContext,
      }),
    ),
    setSupportMode: vi.fn((supportMode) => {
      const next = { ...snapshot, supportMode };
      publish(next);
      return Promise.resolve(next);
    }),
    interrupt: vi.fn(() => {
      const next = {
        ...snapshot,
        activeRequestId: null,
        activeTurnId: null,
        turnStatus: 'cancelled' as const,
      };
      publish(next);
      release?.();
      return Promise.resolve(next);
    }),
    close: vi.fn(() => {
      const next = {
        ...INITIAL_AGENT_SESSION_SNAPSHOT,
        connectionStatus: 'ready' as const,
      };
      publish(next);
      return Promise.resolve(next);
    }),
    purgeConversation: vi.fn().mockResolvedValue(true),
    purgeAll: vi.fn().mockResolvedValue(0),
    stop: vi.fn().mockResolvedValue(undefined),
    subscribeSnapshot: vi.fn((handler: (value: AgentSessionSnapshot) => void) => {
      listeners.add(handler);
      return Promise.resolve(() => {
        listeners.delete(handler);
      });
    }),
    subscribeStream: vi.fn().mockResolvedValue(() => undefined),
  };

  return { service, submit, release: () => release?.() };
}
