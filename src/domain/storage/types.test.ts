import { describe, expect, it } from 'vitest';
import {
  decorateStoredMessageContent,
  isAppSettings,
  isCompanionPreferences,
  isJournalPreferences,
  isConversationDetail,
  isDevelopmentFixtureResult,
  isJournalEntry,
  isStorageError,
  isStorageDiagnostics,
  messageStatusNote,
  storedMessageToChatMessage,
  type StoredMessage,
} from './types';
import { defaultMemoryPreferences } from '../memory/types';
import { defaultJournalPreferences } from '../journal/types';
import { DEFAULT_CONTINUITY_PREFERENCES } from '../continuity/types';

const companionPreferences = {
  buddyVisible: true,
  buddyAlwaysOnTop: true,
  placementMode: 'free',
  ambientAnimationsEnabled: true,
  reducedMovementEnabled: false,
  autonomousMovementEnabled: true,
  movementIntensity: 'medium',
  surfaceInteractionEnabled: true,
  followMovingSurfaces: true,
  cursorAwarenessEnabled: false,
  multiMonitorWanderingEnabled: true,
  sleepAfterInactivitySeconds: 900,
  proactiveCheckinsEnabled: true,
  proactiveCheckinCooldownMinutes: 180,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  doNotDisturb: false,
  globalShortcutEnabled: true,
  launchAtLogin: false,
  openCompanionHomeAtStartup: false,
  bubbleWidth: 340,
} as const;

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
        companionPreferences,
        memoryPreferences: defaultMemoryPreferences,
        journalPreferences: defaultJournalPreferences,
        continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
      }),
    ).toBe(true);
    expect(
      isAppSettings({
        ambientAnimationsEnabled: true,
        conversationRetentionPolicy: 'delete_everything_whenever',
        companionPreferences,
        memoryPreferences: defaultMemoryPreferences,
        journalPreferences: defaultJournalPreferences,
        continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
      }),
    ).toBe(false);
  });

  it('validates companion preferences with bounded values', () => {
    expect(isCompanionPreferences(companionPreferences)).toBe(true);
    expect(
      isCompanionPreferences({
        ...companionPreferences,
        sleepAfterInactivitySeconds: 10,
      }),
    ).toBe(false);
    expect(
      isCompanionPreferences({
        ...companionPreferences,
        quietHoursStart: '7:00',
      }),
    ).toBe(false);
  });

  it('validates journal preferences and journal entries at the native boundary', () => {
    expect(isJournalPreferences(defaultJournalPreferences)).toBe(true);
    expect(
      isJournalPreferences({
        ...defaultJournalPreferences,
        journalCheckInCooldownMinutes: 5,
      }),
    ).toBe(false);
    expect(
      isJournalEntry({
        id: 'journal-1',
        kind: 'trading_session',
        title: 'Session review',
        body: 'I followed my risk rule and stopped after two trades.',
        status: 'completed',
        sourceKind: 'desktop_guided',
        occurredAt: '2026-06-23T00:00:00Z',
        createdAt: '2026-06-23T00:00:00Z',
        updatedAt: '2026-06-23T00:00:00Z',
        completedAt: '2026-06-23T00:00:00Z',
        allowMemoryCandidates: false,
        isPrivate: true,
        tags: ['trading'],
      }),
    ).toBe(true);
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
