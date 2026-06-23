import { describe, expect, it } from 'vitest';
import {
  decorateStoredMessageContent,
  isAppSettings,
  isConversationDetail,
  isDevelopmentFixtureResult,
  isStorageError,
  isStorageDiagnostics,
  messageStatusNote,
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

  it('keeps stored content raw and exposes status notes separately', () => {
    expect(decorateStoredMessageContent({ ...baseMessage, status: 'cancelled' })).toBe(
      'Visible partial',
    );
    expect(messageStatusNote({ ...baseMessage, status: 'cancelled' })).toBe(
      'You stopped this generation.',
    );
    expect(messageStatusNote({ ...baseMessage, status: 'failed' })).toBe(
      'Generation failed. Technical details are not shown in the conversation.',
    );
    expect(messageStatusNote({ ...baseMessage, status: 'interrupted' })).toBe(
      'The app closed or generation stopped unexpectedly.',
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
      status: 'completed',
    });
  });

  it('validates storage diagnostics and development fixture responses', () => {
    expect(
      isStorageDiagnostics({
        available: true,
        databaseFileName: 'trading-buddy.db',
        databaseLocationSummary: 'com.tradingbuddy.desktop\\trading-buddy.db',
        schemaVersion: 1,
        conversationCount: 2,
        activeConversationCount: 1,
        archivedConversationCount: 1,
        messageCount: 4,
      }),
    ).toBe(true);
    expect(
      isStorageDiagnostics({
        available: true,
        databaseFileName: 'trading-buddy.db',
        conversationCount: '2',
        activeConversationCount: 1,
        archivedConversationCount: 1,
        messageCount: 4,
      }),
    ).toBe(false);
    expect(
      isDevelopmentFixtureResult({
        conversationId: 'conversation-1',
        assistantMessageId: 'message-1',
      }),
    ).toBe(true);
  });
});
