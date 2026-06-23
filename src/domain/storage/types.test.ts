import { describe, expect, it } from 'vitest';
import {
  decorateStoredMessageContent,
  isAppSettings,
  isConversationDetail,
  isStorageError,
  storedMessageToChatMessage,
  type StoredMessage,
} from './types';

const baseMessage: StoredMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  role: 'assistant',
  content: 'Visible partial',
  status: 'completed',
  createdAt: '2026-06-23T00:00:00Z',
  updatedAt: '2026-06-23T00:00:00Z',
};

describe('storage frontend types', () => {
  it('validates typed storage errors at the native boundary', () => {
    expect(
      isStorageError({
        code: 'write_failed',
        userMessage: 'Could not save.',
        retryable: true,
      }),
    ).toBe(true);
    expect(
      isStorageError({
        code: 'sql_went_sideways',
        userMessage: 'Raw badness.',
        retryable: true,
      }),
    ).toBe(false);
  });

  it('validates app settings without accepting arbitrary retention policies', () => {
    expect(
      isAppSettings({
        ambientAnimationsEnabled: true,
        conversationRetentionPolicy: 'keep_until_delete',
        selectedLocalModel: 'qwen3:4b',
      }),
    ).toBe(true);
    expect(
      isAppSettings({
        ambientAnimationsEnabled: true,
        conversationRetentionPolicy: 'delete_everything_whenever',
      }),
    ).toBe(false);
  });

  it('validates persisted conversations with messages', () => {
    expect(
      isConversationDetail({
        conversation: {
          id: 'conversation-1',
          title: 'Hello',
          createdAt: '2026-06-23T00:00:00Z',
          updatedAt: '2026-06-23T00:00:00Z',
          messageCount: 1,
        },
        messages: [baseMessage],
      }),
    ).toBe(true);
  });

  it('decorates non-completed assistant messages without changing stored content', () => {
    expect(decorateStoredMessageContent({ ...baseMessage, status: 'cancelled' })).toContain(
      '[Cancelled]',
    );
    expect(decorateStoredMessageContent({ ...baseMessage, status: 'failed' })).toContain(
      '[Failed]',
    );
    expect(decorateStoredMessageContent({ ...baseMessage, status: 'interrupted' })).toContain(
      '[Interrupted]',
    );
    expect(baseMessage.content).toBe('Visible partial');
  });

  it('maps stored messages into chat messages', () => {
    const chatMessage = storedMessageToChatMessage({
      ...baseMessage,
      role: 'user',
      content: 'Hello buddy',
    });
    expect(chatMessage).toEqual({
      id: 'message-1',
      role: 'user',
      content: 'Hello buddy',
      createdAt: '2026-06-23T00:00:00Z',
    });
  });
});
