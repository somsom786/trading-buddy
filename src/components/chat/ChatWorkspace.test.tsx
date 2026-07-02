import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CompanionService } from '../../services/tauri/companionService';
import type { LocalAiService } from '../../services/tauri/localAiService';
import type { StorageService } from '../../services/tauri/storageService';
import type { WindowService } from '../../services/windowService';
import { defaultMemoryPreferences } from '../../domain/memory/types';
import { defaultJournalPreferences } from '../../domain/journal/types';
import { DEFAULT_CONTINUITY_PREFERENCES } from '../../domain/continuity/types';
import { ChatWorkspace } from './ChatWorkspace';
import { createFakeAgentSessionService } from '../../test/fakeAgentSessionService';

const companionService: CompanionService = {
  setState: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  emitInteraction: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(() => {
    return undefined;
  }),
  subscribeInteractions: vi.fn().mockResolvedValue(() => {
    return undefined;
  }),
  startDragging: vi.fn().mockResolvedValue(undefined),
};

const windowService: WindowService = {
  openMainWindow: vi.fn().mockResolvedValue(undefined),
  toggleCompanionBubble: vi.fn().mockResolvedValue(undefined),
  controlBubble: vi.fn().mockResolvedValue(undefined),
  positionCompanionBubble: vi.fn().mockResolvedValue(undefined),
  resetBuddyPosition: vi.fn().mockResolvedValue(undefined),
  controlBuddy: vi.fn().mockResolvedValue(undefined),
  getOsIdleSeconds: vi.fn().mockResolvedValue(0),
};

const companionPreferences = {
  buddyVisible: true,
  buddyAlwaysOnTop: true,
  placementMode: 'free' as const,
  ambientAnimationsEnabled: true,
  reducedMovementEnabled: false,
  autonomousMovementEnabled: true,
  movementIntensity: 'medium' as const,
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

function createStorageService(): {
  service: StorageService;
  prepareGeneration: ReturnType<typeof vi.fn>;
  completeAssistant: ReturnType<typeof vi.fn>;
  exportConversations: ReturnType<typeof vi.fn>;
} {
  const prepareGeneration = vi.fn((request) => {
    const now = '2026-06-23T00:00:00Z';
    return Promise.resolve({
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
    });
  });
  const completeAssistant = vi.fn().mockResolvedValue(undefined);
  const exportConversations = vi.fn().mockResolvedValue(null);
  const service: StorageService = {
    status: vi.fn().mockResolvedValue({
      available: true,
      databasePath: 'C:\\Users\\trader\\AppData\\Local\\Trading Buddy\\trading-buddy.db',
      schemaVersion: 1,
    }),
    diagnostics: vi.fn().mockResolvedValue({
      available: true,
      databaseFileName: 'trading-buddy.db',
      databaseLocationSummary: 'Trading Buddy\\trading-buddy.db',
      schemaVersion: 1,
      conversationCount: 0,
      activeConversationCount: 0,
      archivedConversationCount: 0,
      messageCount: 0,
    }),
    getSettings: vi.fn().mockResolvedValue({
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    }),
    setSelectedModel: vi.fn().mockResolvedValue({
      selectedLocalModel: 'qwen3:4b',
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    }),
    setCompanionPreferences: vi.fn().mockResolvedValue({
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    }),
    setMemoryPreferences: vi.fn().mockResolvedValue({
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    }),
    setJournalPreferences: vi.fn().mockResolvedValue({
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    }),
    setContinuityPreferences: vi.fn().mockResolvedValue({
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    }),
    setRetentionPolicy: vi.fn().mockResolvedValue({ removedConversations: 0 }),
    applyRetentionCleanup: vi.fn().mockResolvedValue({ removedConversations: 0 }),
    listConversations: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn(),
    setLastOpenedConversation: vi.fn().mockResolvedValue(undefined),
    getLastOpenedConversation: vi.fn().mockResolvedValue(null),
    prepareGeneration,
    checkpointAssistant: vi.fn().mockResolvedValue(undefined),
    completeAssistant,
    cancelAssistant: vi.fn().mockResolvedValue(undefined),
    failAssistant: vi.fn().mockResolvedValue(undefined),
    renameConversation: vi.fn(),
    archiveConversation: vi.fn(),
    restoreConversation: vi.fn(),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
    deleteAllConversationData: vi.fn().mockResolvedValue({ deletedConversations: 0 }),
    exportConversations,
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
    createJournalEntry: vi.fn(),
    updateJournalEntry: vi.fn(),
    getJournalEntry: vi.fn(),
    listJournalEntries: vi.fn().mockResolvedValue([]),
    deleteJournalEntry: vi.fn().mockResolvedValue(undefined),
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
    createDevelopmentInterruptedFixture: vi.fn().mockResolvedValue({
      conversationId: 'conversation-fixture',
      assistantMessageId: 'message-fixture',
    }),
  };
  return { service, prepareGeneration, completeAssistant, exportConversations };
}

describe('ChatWorkspace', () => {
  it('does not reload the last conversation after starting a new chat', async () => {
    const user = userEvent.setup();
    const { service: storageService } = createStorageService();
    const now = '2026-06-28T00:00:00Z';
    storageService.getSettings = vi.fn().mockResolvedValue({
      selectedLocalModel: 'qwen3:4b',
      ambientAnimationsEnabled: true,
      conversationRetentionPolicy: 'keep_until_delete',
      lastOpenedConversationId: 'conversation-old',
      companionPreferences,
      memoryPreferences: defaultMemoryPreferences,
      journalPreferences: defaultJournalPreferences,
      continuityPreferences: DEFAULT_CONTINUITY_PREFERENCES,
    });
    storageService.listConversations = vi.fn().mockImplementation(({ archived }) =>
      Promise.resolve(
        archived
          ? []
          : [
              {
                id: 'conversation-old',
                title: 'Old conversation',
                createdAt: now,
                updatedAt: now,
                messageCount: 1,
              },
            ],
      ),
    );
    const getConversation = vi.fn().mockResolvedValue({
      conversation: {
        id: 'conversation-old',
        title: 'Old conversation',
        createdAt: now,
        updatedAt: now,
        messageCount: 1,
      },
      messages: [
        {
          id: 'message-old',
          conversationId: 'conversation-old',
          role: 'user',
          content: 'Old message that must stay cleared',
          status: 'completed',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    storageService.getConversation = getConversation;
    const localAiService: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat: vi.fn(),
    };

    render(
      <ChatWorkspace
        localAiService={localAiService}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={createFakeAgentSessionService().service}
      />,
    );

    await screen.findByText('Old message that must stay cleared');
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await waitFor(() => {
      expect(screen.queryByText('Old message that must stay cleared')).not.toBeInTheDocument();
    });
    expect(getConversation).toHaveBeenCalledOnce();
  });

  it('uses the pinned cloud model and streams a response into the assistant placeholder', async () => {
    const user = userEvent.setup();
    const { service: storageService, prepareGeneration } = createStorageService();
    const agent = createFakeAgentSessionService({ responseText: 'Local hello' });
    const streamChat = vi.fn((request, onEvent) => {
      onEvent({ type: 'started', requestId: request.requestId });
      onEvent({ type: 'content_delta', requestId: request.requestId, content: 'Local hello' });
      onEvent({ type: 'completed', requestId: request.requestId });
      return Promise.resolve();
    });
    const service: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat,
    };
    render(
      <ChatWorkspace
        localAiService={service}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={agent.service}
      />,
    );

    await screen.findByText('Cloud companion ready');
    const input = screen.getByRole('textbox', { name: 'Message' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Local hello');
    expect(agent.submit).toHaveBeenCalledOnce();
    expect(streamChat).not.toHaveBeenCalled();
    expect(prepareGeneration).not.toHaveBeenCalled();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('prevents duplicate submission while a request is active', async () => {
    const user = userEvent.setup();
    const { service: storageService } = createStorageService();
    let release: (() => void) | undefined;
    const streamChat = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const service: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat,
    };
    const agent = createFakeAgentSessionService({ holdResponse: true });
    render(
      <ChatWorkspace
        localAiService={service}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={agent.service}
      />,
    );
    await screen.findByText('Cloud companion ready');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'One request');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    expect(agent.submit).toHaveBeenCalledOnce();
    expect(streamChat).not.toHaveBeenCalled();
    agent.release();
    if (release) {
      release();
    }
  });

  it('shows a cloud-offline state without depending on Ollama discovery', async () => {
    const { service: storageService } = createStorageService();
    const service: LocalAiService = {
      listModels: vi.fn().mockRejectedValue({
        code: 'ollama_not_running',
        userMessage: 'Ollama is not running.',
        technicalMessage: 'connection refused',
        retryable: true,
      }),
      streamChat: vi.fn(),
      cancel: vi.fn(),
    };
    render(
      <ChatWorkspace
        localAiService={service}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={createFakeAgentSessionService({ connectionStatus: 'failed' }).service}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Cloud companion offline')).toBeInTheDocument();
    });
    expect(screen.queryByText(/127.0.0.1:11434/)).not.toBeInTheDocument();
  });

  it('runs the Buddy Lab mock stream without making a cloud request', async () => {
    const user = userEvent.setup();
    const { service: storageService } = createStorageService();
    const streamChat = vi.fn();
    const service: LocalAiService = {
      listModels: vi.fn().mockRejectedValue({
        code: 'ollama_not_running',
        userMessage: 'Ollama is not running.',
        retryable: true,
      }),
      streamChat,
      cancel: vi.fn(),
    };
    render(
      <ChatWorkspace
        localAiService={service}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={createFakeAgentSessionService().service}
      />,
    );
    await screen.findByText('Cloud companion ready');
    await user.click(screen.getByRole('button', { name: 'Mock stream' }));
    await screen.findByText('This is a local mock stream. No cloud request was made.', undefined, {
      timeout: 2_000,
    });
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('keeps temporary chat out of persistent storage', async () => {
    const user = userEvent.setup();
    const { service: storageService, prepareGeneration } = createStorageService();
    const streamChat = vi.fn((request, onEvent) => {
      onEvent({ type: 'started', requestId: request.requestId });
      onEvent({ type: 'content_delta', requestId: request.requestId, content: 'Temporary hello' });
      onEvent({ type: 'completed', requestId: request.requestId });
      return Promise.resolve();
    });
    const service: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat,
    };
    const agent = createFakeAgentSessionService({ responseText: 'Temporary hello' });
    render(
      <ChatWorkspace
        localAiService={service}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={agent.service}
      />,
    );

    await screen.findByText('Cloud companion ready');
    await user.click(screen.getByRole('button', { name: 'Temporary chat' }));
    expect(screen.getByText(/Temporary mode is in-memory only/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Do not save this');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Temporary hello');
    expect(agent.submit).toHaveBeenCalledOnce();
    expect(streamChat).not.toHaveBeenCalled();
    expect(prepareGeneration).not.toHaveBeenCalled();
  });

  it('reports exports by filename instead of exposing the full private path', async () => {
    const user = userEvent.setup();
    const { service: storageService, exportConversations } = createStorageService();
    exportConversations.mockResolvedValueOnce({
      exportedConversations: 2,
      filePath: 'C:\\Users\\trader\\Desktop\\private-folder\\buddy-export.json',
      fileName: 'buddy-export.json',
    });
    const service: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat: vi.fn(),
    };
    render(
      <ChatWorkspace
        localAiService={service}
        storageService={storageService}
        companionService={companionService}
        windowService={windowService}
        agentSessionService={createFakeAgentSessionService().service}
      />,
    );

    await screen.findByText('Cloud companion ready');
    await user.click(screen.getByText('Privacy and storage'));
    await user.click(screen.getByRole('button', { name: 'Export conversations' }));

    expect(
      await screen.findByText(/Exported 2 conversation\(s\) to buddy-export\.json\./),
    ).toBeInTheDocument();
    expect(screen.getByText('Last export: buddy-export.json')).toBeInTheDocument();
    expect(screen.queryByText(/private-folder/)).not.toBeInTheDocument();
  });
});
