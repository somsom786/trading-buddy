import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CompanionService } from '../services/tauri/companionService';
import type { LocalAiService } from '../services/tauri/localAiService';
import type { StorageService } from '../services/tauri/storageService';
import type { WindowService } from '../services/windowService';
import { defaultMemoryPreferences } from '../domain/memory/types';
import { BubbleView } from './BubbleView';

const companionService: CompanionService = {
  setState: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
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
  return {
    prepareGeneration,
    completeAssistant,
    service: {
      status: vi.fn().mockResolvedValue({ available: true, schemaVersion: 2 }),
      diagnostics: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({
        selectedLocalModel: 'qwen3:4b',
        ambientAnimationsEnabled: true,
        conversationRetentionPolicy: 'keep_until_delete',
        companionPreferences,
        memoryPreferences: defaultMemoryPreferences,
      }),
      setSelectedModel: vi.fn(),
      setCompanionPreferences: vi.fn(),
      setMemoryPreferences: vi.fn(),
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
      updateMemoryContent: vi.fn(),
      deleteMemory: vi.fn(),
      deleteAllMemories: vi.fn().mockResolvedValue({ deletedMemories: 0 }),
      cleanupExpiredMemories: vi.fn().mockResolvedValue(0),
      retrieveMemories: vi.fn().mockResolvedValue([]),
      recordMemoryUsage: vi.fn().mockResolvedValue(undefined),
      listMemoryUsageRecords: vi.fn().mockResolvedValue([]),
      exportMemories: vi.fn().mockResolvedValue(null),
      createDevelopmentInterruptedFixture: vi.fn(),
    },
  };
}

describe('BubbleView', () => {
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
});
