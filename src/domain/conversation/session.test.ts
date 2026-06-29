import { describe, expect, it } from 'vitest';
import type { LocalAiError } from '../local-ai/types';
import {
  canSubmitMessage,
  conversationReducer,
  createChatMessage,
  createConversationSession,
  validateMessageInput,
} from './session';

function generatingSession() {
  const initial = {
    ...createConversationSession('conversation-1'),
    selectedModel: 'qwen3:4b',
    status: 'ready' as const,
  };
  return conversationReducer(initial, {
    type: 'start_generation',
    requestId: 'request-1',
    userMessage: createChatMessage('user', 'Hello'),
    assistantMessage: createChatMessage('assistant', ''),
  });
}

describe('conversationReducer', () => {
  it('adds a user message and assistant placeholder when generation starts', () => {
    const session = generatingSession();
    expect(session.messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '' },
    ]);
    expect(session.activeRequestId).toBe('request-1');
  });

  it('appends streamed chunks to the active assistant message', () => {
    const session = conversationReducer(generatingSession(), {
      type: 'stream_event',
      event: { type: 'content_delta', requestId: 'request-1', content: 'Hi there' },
    });
    expect(session.messages.at(-1)?.content).toBe('Hi there');
  });

  it('ignores chunks from stale requests', () => {
    const session = generatingSession();
    expect(
      conversationReducer(session, {
        type: 'stream_event',
        event: { type: 'content_delta', requestId: 'stale', content: 'Wrong' },
      }),
    ).toBe(session);
  });

  it('completes and cancels active requests without remaining stuck', () => {
    const completed = conversationReducer(generatingSession(), {
      type: 'stream_event',
      event: { type: 'completed', requestId: 'request-1' },
    });
    expect(completed).toMatchObject({ activeRequestId: null, status: 'ready' });
    expect(completed.messages.at(-1)).toMatchObject({
      role: 'assistant',
      status: 'completed',
    });

    const cancelled = conversationReducer(generatingSession(), {
      type: 'stream_event',
      event: { type: 'cancelled', requestId: 'request-1' },
    });
    expect(cancelled).toMatchObject({ activeRequestId: null, status: 'ready' });
    expect(cancelled.messages.at(-1)).toMatchObject({
      role: 'assistant',
      status: 'cancelled',
      statusNote: 'Generation was stopped.',
    });
  });

  it('records a typed provider failure', () => {
    const error: LocalAiError = {
      code: 'generation_failed',
      userMessage: 'Failed',
      retryable: true,
    };
    const failed = conversationReducer(generatingSession(), {
      type: 'stream_event',
      event: { type: 'failed', requestId: 'request-1', error },
    });
    expect(failed).toMatchObject({ activeRequestId: null, status: 'error', error });
    expect(failed.messages.at(-1)).toMatchObject({
      role: 'assistant',
      status: 'failed',
      statusNote: 'Failed',
    });
  });

  it('prevents duplicate generation starts', () => {
    const session = generatingSession();
    const duplicate = conversationReducer(session, {
      type: 'start_generation',
      requestId: 'request-2',
      userMessage: createChatMessage('user', 'Again'),
      assistantMessage: createChatMessage('assistant', ''),
    });
    expect(duplicate).toBe(session);
  });
});

describe('message validation', () => {
  it('rejects blank and over-limit messages', () => {
    expect(validateMessageInput('   ', 20)).toEqual({ valid: false, reason: 'blank' });
    expect(validateMessageInput('12345', 4)).toEqual({ valid: false, reason: 'too_long' });
  });

  it('allows submission only with a model and no active generation', () => {
    const ready = {
      ...createConversationSession('conversation-1'),
      selectedModel: 'qwen3:4b',
      status: 'ready' as const,
    };
    expect(canSubmitMessage(ready, ' hello ', 20)).toBe(true);
    expect(canSubmitMessage(generatingSession(), 'hello', 20)).toBe(false);
  });
});
