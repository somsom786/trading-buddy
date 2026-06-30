import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompanionService } from '../services/tauri/companionService';
import type { LocalAiService } from '../services/tauri/localAiService';
import type { StorageService } from '../services/tauri/storageService';
import type { WindowService } from '../services/windowService';
import { defaultMemoryPreferences } from '../domain/memory/types';
import { defaultJournalPreferences } from '../domain/journal/types';
import { DEFAULT_CONTINUITY_PREFERENCES } from '../domain/continuity/types';
import { BubbleView } from './BubbleView';

const companionSend = vi.fn().mockResolvedValue(undefined);
const companionService: CompanionService = {
  setState: vi.fn().mockResolvedValue(undefined),
  send: companionSend,
  emitInteraction: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(() => undefined),
  subscribeInteractions: vi.fn().mockResolvedValue(() => undefined),
  startDragging: vi.fn().mockResolvedValue(undefined),
};

const companionPreferences = {
  buddyVisible: true,
  buddyAlwaysOnTop: true,
  placementMode: 'free' as const,
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
};

function createWindowService(): {
  service: WindowService;
  openMainWindow: ReturnType<typeof vi.fn>;
  controlBubble: ReturnType<typeof vi.fn>;
} {
  const openMainWindow = vi.fn().mockResolvedValue(undefined);
  const controlBubble = vi.fn().mockResolvedValue(undefined);
  return {
    openMainWindow,
    controlBubble,
    service: {
      openMainWindow,
      toggleCompanionBubble: vi.fn().mockResolvedValue(undefined),
      controlBubble,
      positionCompanionBubble: vi.fn().mockResolvedValue(undefined),
      resetBuddyPosition: vi.fn().mockResolvedValue(undefined),
      controlBuddy: vi.fn().mockResolvedValue(undefined),
      getOsIdleSeconds: vi.fn().mockResolvedValue(0),
    },
  };
}

function createStorageService(): {
  service: StorageService;
  prepareGeneration: ReturnType<typeof vi.fn>;
  completeAssistant: ReturnType<typeof vi.fn>;
  createJournalEntry: ReturnType<typeof vi.fn>;
} {
  const now = '2026-06-23T00:00:00Z';
  const prepareGeneration = vi.fn((request) =>
    Promise.resolve({
      conversation: {
        id: 'conversation-1',
        title: request.userContent,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        lastMessagePreview: request.userContent,
        messageCount: 2,
      },
      userMessage: {
        id: 'message-user',
        conversationId: 'conversation-1',
        role: 'user' as const,
        content: request.userContent,
        status: 'completed' as const,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      },
      assistantMessage: {
        id: 'message-assistant',
        conversationId: 'conversation-1',
        role: 'assistant' as const,
        content: '',
        status: 'streaming' as const,
        modelName: request.modelName,
        requestId: request.requestId,
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
  const completeAssistant = vi.fn().mockResolvedValue(undefined);
  const createJournalEntry = vi.fn().mockResolvedValue({
    id: 'journal-1',
    kind: 'free_reflection',
    title: 'Journal entry',
    body: 'Journal body',
    status: 'completed',
    sourceKind: 'desktop_guided',
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    allowMemoryCandidates: false,
    isPrivate: true,
    tags: [],
  });
  return {
    prepareGeneration,
    completeAssistant,
    createJournalEntry,
    service: {
      status: vi.fn().mockResolvedValue({ available: true, schemaVersion: 2 }),
      diagnostics: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({
        selectedLocalModel: 'qwen3:4b',
        ambientAnimationsEnabled: true,
        conversationRetentionPolicy: 'keep_until_delete',
        companionPreferences,
        memoryPreferences: defaultMemoryPreferences,
        journalPreferences: defaultJournalPreferences,
        continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
      }),
      setSelectedModel: vi.fn(),
      setCompanionPreferences: vi.fn(),
      setMemoryPreferences: vi.fn(),
      setJournalPreferences: vi.fn(),
      setContinuityPreferences: vi.fn(),
      setRetentionPolicy: vi.fn(),
      applyRetentionCleanup: vi.fn(),
      listConversations: vi.fn(),
      getConversation: vi.fn(),
      setLastOpenedConversation: vi.fn(),
      getLastOpenedConversation: vi.fn(),
      prepareGeneration,
      checkpointAssistant: vi.fn(),
      completeAssistant,
      cancelAssistant: vi.fn(),
      failAssistant: vi.fn(),
      renameConversation: vi.fn(),
      archiveConversation: vi.fn(),
      restoreConversation: vi.fn(),
      deleteConversation: vi.fn(),
      deleteAllConversationData: vi.fn(),
      exportConversations: vi.fn(),
      createMemory: vi.fn(),
      listMemories: vi.fn().mockResolvedValue([]),
      confirmMemory: vi.fn(),
      rejectMemory: vi.fn(),
      restoreMemory: vi.fn(),
      updateMemoryContent: vi.fn(),
      updateMemoryExpiry: vi.fn(),
      supersedeMemory: vi.fn(),
      deleteMemory: vi.fn(),
      deleteAllMemories: vi.fn().mockResolvedValue({ deletedMemories: 0 }),
      cleanupExpiredMemories: vi.fn().mockResolvedValue(0),
      retrieveMemories: vi.fn().mockResolvedValue([]),
      recordMemoryUsage: vi.fn().mockResolvedValue(undefined),
      listMemoryUsageRecords: vi.fn().mockResolvedValue([]),
      exportMemories: vi.fn().mockResolvedValue(null),
      createJournalEntry,
      updateJournalEntry: vi.fn(),
      getJournalEntry: vi.fn(),
      listJournalEntries: vi.fn().mockResolvedValue([]),
      deleteJournalEntry: vi.fn(),
      deleteAllJournalEntries: vi.fn().mockResolvedValue({ deletedEntries: 0 }),
      exportJournalJson: vi.fn().mockResolvedValue(null),
      exportJournalMarkdown: vi.fn().mockResolvedValue(null),
      getJournalDiagnostics: vi.fn().mockResolvedValue({
        totalCount: 0,
        draftCount: 0,
        completedCount: 0,
        discardedCount: 0,
        privateCount: 0,
        fixtureCount: 0,
        tagCount: 0,
        ftsAvailable: true,
      }),
      createDevelopmentJournalFixtures: vi.fn().mockResolvedValue({
        createdEntries: 0,
        deletedEntries: 0,
      }),
      deleteDevelopmentJournalFixtures: vi.fn().mockResolvedValue({
        createdEntries: 0,
        deletedEntries: 0,
      }),
      getMemoryDiagnostics: vi.fn().mockResolvedValue({
        totalCount: 0,
        proposedCount: 0,
        confirmedCount: 0,
        rejectedCount: 0,
        expiredCount: 0,
        supersededCount: 0,
        sensitiveCount: 0,
        ftsAvailable: true,
        fixtureCount: 0,
      }),
      createDevelopmentMemoryFixtures: vi.fn().mockResolvedValue({
        createdMemories: 0,
        deletedMemories: 0,
      }),
      deleteDevelopmentMemoryFixtures: vi.fn().mockResolvedValue({
        createdMemories: 0,
        deletedMemories: 0,
      }),
      createDevelopmentInterruptedFixture: vi.fn(),
    },
  };
}

describe('BubbleView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends through the persistent storage and local AI pipeline', async () => {
    const user = userEvent.setup();
    const {
      service: storageService,
      prepareGeneration,
      completeAssistant,
    } = createStorageService();
    const streamChat = vi.fn((request, onEvent) => {
      onEvent({ type: 'started', requestId: request.requestId });
      onEvent({ type: 'content_delta', requestId: request.requestId, content: 'Desk hello' });
      onEvent({ type: 'completed', requestId: request.requestId });
      return Promise.resolve();
    });
    const localAiService: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      streamChat,
      cancel: vi.fn(),
    };
    render(
      <BubbleView
        localAiService={localAiService}
        storageService={storageService}
        companionService={companionService}
        windowService={createWindowService().service}
      />,
    );

    await screen.findByText('local AI ready');
    await user.type(screen.getByRole('textbox', { name: 'Message Buddy' }), 'hello bubble');
    await user.keyboard('{Enter}');

    await screen.findByText('Desk hello');
    expect(prepareGeneration).toHaveBeenCalledOnce();
    expect(streamChat).toHaveBeenCalledOnce();
    expect(completeAssistant).toHaveBeenCalledOnce();
  });

  it('collapses with Escape and opens Companion Home only through an explicit action', async () => {
    const user = userEvent.setup();
    const { service: storageService } = createStorageService();
    const { service: windowService, controlBubble, openMainWindow } = createWindowService();
    render(
      <BubbleView
        localAiService={{
          listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
          streamChat: vi.fn(),
          cancel: vi.fn(),
        }}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
      />,
    );

    await screen.findByText('local AI ready');
    await user.keyboard('{Escape}');
    expect(controlBubble).toHaveBeenCalledWith('hide');

    await user.click(screen.getByRole('button', { name: 'Open Home' }));
    await waitFor(() => {
      expect(openMainWindow).toHaveBeenCalledOnce();
    });
  });

  it('starts and explicitly saves a desktop journal session without calling local AI', async () => {
    const user = userEvent.setup();
    const { service: storageService, createJournalEntry } = createStorageService();
    const streamChat = vi.fn();
    render(
      <BubbleView
        localAiService={{
          listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
          streamChat,
          cancel: vi.fn(),
        }}
        storageService={storageService}
        companionService={companionService}
        windowService={createWindowService().service}
      />,
    );

    await screen.findByText('local AI ready');
    await user.type(screen.getByRole('textbox', { name: 'Message Buddy' }), "let's journal");
    await user.keyboard('{Enter}');

    await screen.findByText('Buddy is journaling with you');
    await user.type(
      screen.getByRole('textbox', { name: 'Journal text' }),
      'I followed my plan and stopped after the second trade.',
    );
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    await screen.findByText(/Journal entry saved\./);
    expect(createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'free_reflection',
        status: 'completed',
        body: 'I followed my plan and stopped after the second trade.',
        isPrivate: true,
      }),
    );
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('loads the read-only Petdex catalog only when the skin picker opens', async () => {
    const user = userEvent.setup();
    const { service: storageService } = createStorageService();
    const petdexCatalog = vi.fn().mockResolvedValue([
      {
        id: 'boba',
        displayName: 'Boba',
        source: 'petdex',
        submittedBy: 'railly',
        spritesheetUrl: 'https://assets.petdex.dev/community/boba/spritesheet.webp',
      },
    ]);
    render(
      <BubbleView
        localAiService={{
          listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
          streamChat: vi.fn(),
          cancel: vi.fn(),
        }}
        storageService={storageService}
        companionService={companionService}
        windowService={createWindowService().service}
        petdexCatalog={petdexCatalog}
      />,
    );

    expect(petdexCatalog).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Choose pet skin' }));
    await user.click(await screen.findByRole('button', { name: /Boba/ }));

    expect(companionSend).toHaveBeenCalledWith({
      type: 'set_skin',
      skin: expect.objectContaining({ id: 'boba', source: 'petdex' }),
    });
  });
});
