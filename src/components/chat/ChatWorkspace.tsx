import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { buddyStateForLifecycle, type BuddyState } from '../../domain/companion/buddyState';
import {
  canSubmitMessage,
  conversationReducer,
  createChatMessage,
  createConversationSession,
  createId,
  validateMessageInput,
} from '../../domain/conversation/session';
import { LOCAL_AI_CONFIG } from '../../domain/local-ai/config';
import { selectPreferredModel } from '../../domain/local-ai/modelSelection';
import { COMPANION_SYSTEM_PROMPT } from '../../domain/local-ai/systemPrompt';
import {
  normalizeLocalAiError,
  type LocalAiError,
  type LocalAiStatus,
  type LocalChatEvent,
  type LocalChatRequest,
} from '../../domain/local-ai/types';
import {
  normalizeStorageError,
  storedMessageToChatMessage,
  type AssistantMessageFailure,
  type AssistantMessageUpdate,
  type ConversationSummary,
  type ExportResult,
  type RetentionPolicy,
  type StorageDiagnostics,
  type StorageError,
  type StorageStatus,
} from '../../domain/storage/types';
import {
  readableConversationTime,
  summarizeDatabaseLocation,
  summarizeExportDestination,
} from '../../domain/storage/display';
import {
  tauriCompanionService,
  type CompanionService,
} from '../../services/tauri/companionService';
import { tauriLocalAiService, type LocalAiService } from '../../services/tauri/localAiService';
import { tauriStorageService, type StorageService } from '../../services/tauri/storageService';
import { tauriWindowService, type WindowService } from '../../services/windowService';
import {
  buildMemoryContextForMessage,
  handleExplicitMemoryIntent,
  handleForgetMemoryIntent,
  runBackgroundMemoryExtraction,
} from '../../services/memoryWorkflow';
import { BuddyLab } from '../local-ai/BuddyLab';
import { JournalLab } from '../local-ai/JournalLab';
import { MemoryLab } from '../local-ai/MemoryLab';
import { StorageLab } from '../local-ai/StorageLab';
import { ChatComposer } from './ChatComposer';
import { LocalAiStatusPanel } from './LocalAiStatusPanel';
import { MessageList } from './MessageList';
import { ModelSelector } from './ModelSelector';
import { MemoryPanel } from '../memory/MemoryPanel';
import { MemoryProposalCard } from '../memory/MemoryProposalCard';
import { JournalPanel } from '../journal/JournalPanel';
import type { JournalDiagnostics, JournalEntrySummary } from '../../domain/journal/types';
import type { Memory, MemoryDiagnostics, RetrievedMemory } from '../../domain/memory/types';

const CHECKPOINT_CHAR_THRESHOLD = 500;
const CHECKPOINT_INTERVAL_MS = 1_200;

interface ChatWorkspaceProps {
  localAiService?: LocalAiService;
  storageService?: StorageService;
  companionService?: CompanionService;
  windowService?: WindowService;
}

type PersistenceMode = 'persistent' | 'temporary';

interface ActiveAssistantPersistence {
  mode: PersistenceMode;
  conversationId: string;
  messageId: string;
  requestId: string;
  content: string;
  lastSavedLength: number;
  memoryIds: string[];
}

export function ChatWorkspace({
  localAiService = tauriLocalAiService,
  storageService = tauriStorageService,
  companionService = tauriCompanionService,
  windowService = tauriWindowService,
}: ChatWorkspaceProps) {
  const [session, dispatch] = useReducer(conversationReducer, undefined, () =>
    createConversationSession(),
  );
  const [providerStatus, setProviderStatus] = useState<LocalAiStatus>({ status: 'checking' });
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics | null>(null);
  const [memoryDiagnostics, setMemoryDiagnostics] = useState<MemoryDiagnostics | null>(null);
  const [journalDiagnostics, setJournalDiagnostics] = useState<JournalDiagnostics | null>(null);
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<ConversationSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<PersistenceMode>('persistent');
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [buddyState, setBuddyStateValue] = useState<BuddyState>('idle');
  const [retentionPolicy, setRetentionPolicyState] = useState<RetentionPolicy>('keep_until_delete');
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const [pendingMemory, setPendingMemory] = useState<Memory | null>(null);
  const [usedMemories, setUsedMemories] = useState<RetrievedMemory[]>([]);
  const [conversationMemoryOptOut, setConversationMemoryOptOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const selectedModelRef = useRef<string | null>(null);
  const requestKindRef = useRef<'real' | 'mock' | null>(null);
  const mockRunRef = useRef<{ requestId: string; cancelled: boolean } | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const assistantPersistenceRef = useRef<ActiveAssistantPersistence | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeRequestRef.current = session.activeRequestId;
    selectedModelRef.current = session.selectedModel;
  }, [session.activeRequestId, session.selectedModel]);

  const setBuddyState = useCallback(
    (state: BuddyState) => {
      setBuddyStateValue(state);
      void companionService.setState(state);
    },
    [companionService],
  );

  const refreshDiagnostics = useCallback(async () => {
    try {
      const diagnostics = await storageService.diagnostics();
      setStorageDiagnostics(diagnostics);
      setMemoryDiagnostics(await storageService.getMemoryDiagnostics());
      setJournalDiagnostics(await storageService.getJournalDiagnostics());
      if (diagnostics.error) {
        setStorageError(diagnostics.error);
      }
      return diagnostics;
    } catch (error) {
      const normalized = normalizeStorageError(error);
      setStorageError(normalized);
      return null;
    }
  }, [storageService]);

  const refreshConversationLists = useCallback(async () => {
    const [active, archived] = await Promise.all([
      storageService.listConversations({ archived: false, limit: 50 }),
      storageService.listConversations({ archived: true, limit: 50 }),
    ]);
    setConversations(active);
    setArchivedConversations(archived);
    void refreshDiagnostics();
    return { active, archived };
  }, [refreshDiagnostics, storageService]);

  const confirmLeavingTemporary = useCallback(
    (nextModeLabel: string) => {
      if (mode !== 'temporary' || session.messages.length === 0) {
        return true;
      }
      return window.confirm(
        `Leave temporary chat for ${nextModeLabel}? Temporary messages are not saved and will be cleared.`,
      );
    },
    [mode, session.messages.length],
  );

  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (activeRequestRef.current) {
        setStorageNotice('Stop the current generation before switching conversations.');
        return;
      }
      if (!confirmLeavingTemporary('this saved conversation')) {
        return;
      }
      try {
        const detail = await storageService.getConversation(conversationId);
        dispatch({
          type: 'load_session',
          conversationId,
          messages: detail.messages.map(storedMessageToChatMessage),
        });
        setMode('persistent');
        setActiveConversationId(conversationId);
        setConversationMemoryOptOut(false);
        setStorageError(null);
        setStorageNotice(null);
        await storageService.setLastOpenedConversation(conversationId);
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    },
    [confirmLeavingTemporary, storageService],
  );

  useEffect(() => {
    const effectState = { disposed: false };
    void (async () => {
      setLoadingStorage(true);
      try {
        const status = await storageService.status();
        if (effectState.disposed) {
          return;
        }
        setStorageStatus(status);
        if (!status.available) {
          setStorageError(status.error ?? normalizeStorageError('Storage unavailable.'));
          setLoadingStorage(false);
          return;
        }
        const settings = await storageService.getSettings();
        setRetentionPolicyState(settings.conversationRetentionPolicy);
        if (settings.selectedLocalModel) {
          selectedModelRef.current = settings.selectedLocalModel;
          dispatch({ type: 'select_model', model: settings.selectedLocalModel });
        }
        const { active } = await refreshConversationLists();
        const target =
          active.find((conversation) => conversation.id === settings.lastOpenedConversationId) ??
          active[0];
        if (target) {
          await loadConversation(target.id);
        }
      } catch (error) {
        if (!effectState.disposed) {
          setStorageError(normalizeStorageError(error));
        }
      } finally {
        if (!effectState.disposed) {
          setLoadingStorage(false);
        }
      }
    })();
    return () => {
      effectState.disposed = true;
    };
  }, [loadConversation, refreshConversationLists, storageService]);

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;
    void companionService
      .subscribeInteractions((interaction) => {
        if (interaction.type === 'buddy_clicked') {
          setBuddyState('happy');
          window.setTimeout(() => {
            setBuddyState('idle');
          }, 700);
        }
      })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [companionService, setBuddyState]);

  const refreshModels = useCallback(async () => {
    setProviderStatus({ status: 'checking' });
    dispatch({ type: 'provider_checking' });
    try {
      const models = await localAiService.listModels();
      const selectedModel = selectPreferredModel(models, selectedModelRef.current);
      if (!selectedModel) {
        setProviderStatus({ status: 'no_models' });
        setBuddyState(buddyStateForLifecycle('provider_unavailable'));
        return;
      }
      setProviderStatus({ status: 'connected', models });
      dispatch({ type: 'provider_ready', selectedModel });
      selectedModelRef.current = selectedModel;
      void storageService.setSelectedModel(selectedModel).catch((error: unknown) => {
        setStorageError(normalizeStorageError(error));
      });
      setBuddyState('idle');
    } catch (error) {
      const normalized = normalizeLocalAiError(error);
      if (normalized.code === 'ollama_not_running') {
        setProviderStatus({ status: 'ollama_not_running' });
      } else if (normalized.code === 'no_models_installed') {
        setProviderStatus({ status: 'no_models' });
      } else {
        setProviderStatus({ status: 'error', error: normalized });
      }
      dispatch({ type: 'provider_failed', error: normalized });
      setBuddyState(buddyStateForLifecycle('provider_unavailable'));
    }
  }, [localAiService, setBuddyState, storageService]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshModels();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshModels]);

  const flushCheckpoint = useCallback(
    async (finalStatus?: 'completed' | 'cancelled' | 'failed', errorCode?: string) => {
      const persistence = assistantPersistenceRef.current;
      if (persistence?.mode !== 'persistent') {
        return;
      }
      const update: AssistantMessageUpdate = {
        messageId: persistence.messageId,
        requestId: persistence.requestId,
        content: persistence.content,
      };
      try {
        if (finalStatus === 'completed') {
          await storageService.completeAssistant(update);
          if (persistence.memoryIds.length > 0) {
            await storageService.recordMemoryUsage({
              memoryIds: persistence.memoryIds,
              conversationId: persistence.conversationId,
              assistantMessageId: persistence.messageId,
              reasonCode: 'chat_context',
            });
          }
          assistantPersistenceRef.current = null;
        } else if (finalStatus === 'cancelled') {
          await storageService.cancelAssistant(update);
          assistantPersistenceRef.current = null;
        } else if (finalStatus === 'failed') {
          const failure: AssistantMessageFailure = {
            ...update,
            errorCode: errorCode ?? 'generation_failed',
          };
          await storageService.failAssistant(failure);
          assistantPersistenceRef.current = null;
        } else if (persistence.content.length !== persistence.lastSavedLength) {
          await storageService.checkpointAssistant(update);
          persistence.lastSavedLength = persistence.content.length;
        }
        await refreshConversationLists();
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    },
    [refreshConversationLists, storageService],
  );

  const scheduleCheckpoint = useCallback(() => {
    const persistence = assistantPersistenceRef.current;
    if (persistence?.mode !== 'persistent') {
      return;
    }
    if (persistence.content.length - persistence.lastSavedLength >= CHECKPOINT_CHAR_THRESHOLD) {
      void flushCheckpoint();
      return;
    }
    checkpointTimerRef.current ??= window.setTimeout(() => {
      checkpointTimerRef.current = null;
      void flushCheckpoint();
    }, CHECKPOINT_INTERVAL_MS);
  }, [flushCheckpoint]);

  useEffect(
    () => () => {
      if (activeRequestRef.current && requestKindRef.current === 'real') {
        void flushCheckpoint('cancelled').finally(() => {
          if (activeRequestRef.current) {
            void localAiService.cancel(activeRequestRef.current);
          }
        });
      }
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
      if (checkpointTimerRef.current !== null) {
        window.clearTimeout(checkpointTimerRef.current);
      }
    },
    [flushCheckpoint, localAiService],
  );

  const handleStreamEvent = useCallback(
    (event: LocalChatEvent) => {
      dispatch({ type: 'stream_event', event });
      if (event.requestId !== activeRequestRef.current) {
        return;
      }
      if (event.type === 'content_delta') {
        if (assistantPersistenceRef.current?.requestId === event.requestId) {
          assistantPersistenceRef.current.content += event.content;
          scheduleCheckpoint();
        }
        setBuddyState(buddyStateForLifecycle('response_started'));
      } else if (event.type === 'completed') {
        requestKindRef.current = null;
        void flushCheckpoint('completed');
        setBuddyState(buddyStateForLifecycle('generation_completed'));
      } else if (event.type === 'cancelled') {
        requestKindRef.current = null;
        void flushCheckpoint('cancelled');
        setBuddyState(buddyStateForLifecycle('generation_cancelled'));
      } else if (event.type === 'failed') {
        requestKindRef.current = null;
        void flushCheckpoint('failed', event.error.code);
        setBuddyState(buddyStateForLifecycle('generation_failed'));
        errorTimerRef.current = window.setTimeout(() => {
          setBuddyState(
            providerStatus.status === 'connected'
              ? 'idle'
              : buddyStateForLifecycle('provider_unavailable'),
          );
        }, 1_200);
      }
    },
    [flushCheckpoint, providerStatus.status, scheduleCheckpoint, setBuddyState],
  );

  const startGeneration = useCallback(
    async (content: string, requestMode: 'real' | 'mock') => {
      if (activeRequestRef.current || (requestMode === 'real' && !session.selectedModel)) {
        return;
      }
      const requestId = createId('request');
      const selectedModel = session.selectedModel ?? LOCAL_AI_CONFIG.recommendedModel;
      let conversationId = session.id;
      let userMessage = createChatMessage('user', content);
      let assistantMessage = createChatMessage('assistant', '');
      let memoryContext: string | null = null;
      let memoryOptedOutForRequest = conversationMemoryOptOut;
      let memoryNotice: string | null = null;

      if (requestMode === 'real' && mode === 'persistent') {
        try {
          const prepared = await storageService.prepareGeneration({
            requestId,
            userContent: content,
            modelName: selectedModel,
            ...(activeConversationId ? { conversationId: activeConversationId } : {}),
          });
          conversationId = prepared.conversation.id;
          userMessage = storedMessageToChatMessage(prepared.userMessage);
          assistantMessage = storedMessageToChatMessage(prepared.assistantMessage);
          setActiveConversationId(prepared.conversation.id);
          assistantPersistenceRef.current = {
            mode: 'persistent',
            conversationId,
            messageId: prepared.assistantMessage.id,
            requestId,
            content: '',
            lastSavedLength: 0,
            memoryIds: [],
          };
          await refreshConversationLists();
        } catch (error) {
          setStorageError(normalizeStorageError(error));
          return;
        }
      } else {
        assistantPersistenceRef.current = {
          mode: 'temporary',
          conversationId,
          messageId: assistantMessage.id,
          requestId,
          content: '',
          lastSavedLength: 0,
          memoryIds: [],
        };
      }

      if (requestMode === 'real') {
        try {
          const memoryContextResult = await buildMemoryContextForMessage({
            storageService,
            content,
            temporaryChat: mode === 'temporary',
          });
          memoryContext = memoryContextResult.context;
          const retrievedMemories = memoryContextResult.retrieved;
          setUsedMemories(retrievedMemories);
          if (assistantPersistenceRef.current.requestId === requestId) {
            assistantPersistenceRef.current.memoryIds = retrievedMemories.map(
              (memory) => memory.id,
            );
          }
          const forgetResult = await handleForgetMemoryIntent({
            storageService,
            content,
          });
          if (forgetResult.notice) {
            memoryNotice = forgetResult.notice;
          }
          const proposalResult = await handleExplicitMemoryIntent({
            storageService,
            content,
            temporaryChat: mode === 'temporary',
            sourceConversationId: mode === 'persistent' ? conversationId : undefined,
            sourceMessageId: mode === 'persistent' ? userMessage.id : undefined,
            preferences: memoryContextResult.preferences,
          });
          if (proposalResult.proposal?.status === 'proposed') {
            setPendingMemory(proposalResult.proposal);
            setBuddyState('thinking');
          }
          if (proposalResult.usedOptOut === 'conversation') {
            memoryOptedOutForRequest = true;
            setConversationMemoryOptOut(true);
          }
          if (proposalResult.usedOptOut === 'message') {
            memoryOptedOutForRequest = true;
          }
          if (proposalResult.notice) {
            memoryNotice = proposalResult.notice;
          }
        } catch (error) {
          setStorageError(normalizeStorageError(error));
        }
      }

      const request: LocalChatRequest = {
        requestId,
        conversationId,
        model: selectedModel,
        messages: [
          { role: 'system', content: COMPANION_SYSTEM_PROMPT },
          ...(memoryContext ? [{ role: 'system' as const, content: memoryContext }] : []),
          ...session.messages
            .filter((message) => message.content)
            .map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          { role: 'user', content },
        ],
        think: thinking,
      };

      activeRequestRef.current = requestId;
      requestKindRef.current = requestMode;
      mockRunRef.current = requestMode === 'mock' ? { requestId, cancelled: false } : null;
      dispatch({
        type: 'start_generation',
        conversationId,
        requestId,
        userMessage,
        assistantMessage,
      });
      setInput('');
      setStorageError(null);
      setStorageNotice(memoryNotice);
      setBuddyState(buddyStateForLifecycle('message_submitted'));

      if (requestMode === 'mock') {
        const mockEvents: LocalChatEvent[] = [
          { type: 'started', requestId },
          { type: 'content_delta', requestId, content: 'This is a ' },
          { type: 'content_delta', requestId, content: 'local mock stream. ' },
          { type: 'content_delta', requestId, content: 'No Ollama request was made.' },
          { type: 'completed', requestId },
        ];
        for (const event of mockEvents) {
          await delay(180);
          if (mockRunRef.current?.requestId === requestId && mockRunRef.current.cancelled) {
            handleStreamEvent({ type: 'cancelled', requestId });
            return;
          }
          handleStreamEvent(event);
        }
        return;
      }

      try {
        await localAiService.streamChat(request, handleStreamEvent);
        const settings = await storageService.getSettings();
        void runBackgroundMemoryExtraction({
          storageService,
          localAiService,
          content,
          model: selectedModel,
          requestId: createId('memory_request'),
          sourceConversationId: mode === 'persistent' ? conversationId : undefined,
          sourceMessageId: mode === 'persistent' ? userMessage.id : undefined,
          temporaryChat: mode === 'temporary',
          conversationOptedOut: memoryOptedOutForRequest,
          preferences: settings.memoryPreferences,
        })
          .then((proposal) => {
            if (proposal?.status === 'proposed') {
              setPendingMemory(proposal);
              setBuddyState('thinking');
            }
          })
          .catch((error: unknown) => {
            setStorageError(normalizeStorageError(error));
          });
      } catch (error) {
        handleStreamEvent({
          type: 'failed',
          requestId,
          error: normalizeLocalAiError(error),
        });
      }
    },
    [
      activeConversationId,
      conversationMemoryOptOut,
      handleStreamEvent,
      localAiService,
      mode,
      refreshConversationLists,
      session.id,
      session.messages,
      session.selectedModel,
      setBuddyState,
      storageService,
      thinking,
    ],
  );

  const send = () => {
    const validation = validateMessageInput(input, LOCAL_AI_CONFIG.maxInputLength);
    if (validation.valid && canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength)) {
      void startGeneration(validation.content, 'real');
    }
  };

  const stop = useCallback(async () => {
    const requestId = activeRequestRef.current;
    if (!requestId) {
      return;
    }
    if (requestKindRef.current === 'mock') {
      if (mockRunRef.current) {
        mockRunRef.current.cancelled = true;
      }
    } else {
      await localAiService.cancel(requestId);
    }
    handleStreamEvent({ type: 'cancelled', requestId });
  }, [handleStreamEvent, localAiService]);

  const startNewPersistentChat = () => {
    if (activeRequestRef.current) {
      setStorageNotice('Stop the current generation before starting a new chat.');
      return;
    }
    if (!confirmLeavingTemporary('a saved chat')) {
      return;
    }
    setMode('persistent');
    setActiveConversationId(null);
    setConversationMemoryOptOut(false);
    dispatch({ type: 'clear_session' });
    setStorageNotice('New chat is ready. It will be saved after your first message.');
  };

  const startTemporaryChat = () => {
    if (activeRequestRef.current) {
      setStorageNotice('Stop the current generation before switching to temporary chat.');
      return;
    }
    if (mode === 'temporary') {
      setStorageNotice('Temporary chat is already on. Messages here are not saved.');
      return;
    }
    setMode('temporary');
    setActiveConversationId(null);
    setConversationMemoryOptOut(false);
    dispatch({ type: 'clear_session' });
    setStorageNotice('Temporary chat is on. Conversation content will not be written to disk.');
  };

  const exitTemporaryChat = () => {
    if (activeRequestRef.current) {
      setStorageNotice('Stop the current generation before leaving temporary chat.');
      return;
    }
    if (!confirmLeavingTemporary('saved chats')) {
      return;
    }
    setMode('persistent');
    setActiveConversationId(null);
    setConversationMemoryOptOut(false);
    dispatch({ type: 'clear_session' });
    setStorageNotice('Temporary chat cleared. New saved chat is ready.');
  };

  const clear = () => {
    if (mode === 'temporary') {
      if (session.messages.length === 0 || window.confirm('Clear this temporary chat?')) {
        void stop().finally(() => {
          dispatch({ type: 'clear_session' });
        });
      }
      return;
    }
    startNewPersistentChat();
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (session.status === 'generating') {
      return;
    }
    setBuddyState(
      value.trim()
        ? buddyStateForLifecycle('input_started')
        : buddyStateForLifecycle(
            'input_cleared',
            providerStatus.status === 'connected' ? 'idle' : 'concerned',
          ),
    );
  };

  const renameActiveConversation = async () => {
    if (!activeConversationId) {
      return;
    }
    const currentTitle =
      conversations.find((conversation) => conversation.id === activeConversationId)?.title ??
      'New conversation';
    const title = window.prompt('Rename conversation', currentTitle);
    if (title === null) {
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStorageNotice('Conversation title cannot be empty.');
      return;
    }
    try {
      await storageService.renameConversation(activeConversationId, trimmedTitle);
      await refreshConversationLists();
      setStorageNotice('Conversation renamed.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const archiveActiveConversation = async () => {
    if (busyAction || !activeConversationId || !window.confirm('Archive this conversation?')) {
      return;
    }
    setBusyAction('archive');
    try {
      await stop();
      await storageService.archiveConversation(activeConversationId);
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      await refreshConversationLists();
      setStorageNotice('Conversation archived.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const deleteActiveConversation = async () => {
    if (
      busyAction ||
      !activeConversationId ||
      !window.confirm('Permanently delete this conversation?')
    ) {
      return;
    }
    setBusyAction('delete');
    try {
      await stop();
      await storageService.deleteConversation(activeConversationId);
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      const { active } = await refreshConversationLists();
      if (active[0]) {
        await loadConversation(active[0].id);
      }
      setStorageNotice('Conversation deleted.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const restoreConversation = async (conversationId: string) => {
    if (busyAction) {
      return;
    }
    setBusyAction(`restore:${conversationId}`);
    try {
      await storageService.restoreConversation(conversationId);
      await refreshConversationLists();
      setShowArchived(false);
      await loadConversation(conversationId);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const clearAllData = async () => {
    if (busyAction) {
      return;
    }
    const confirmation = window.prompt(
      'Type DELETE to permanently delete all saved conversations.',
      '',
    );
    if (confirmation !== 'DELETE') {
      return;
    }
    setBusyAction('delete-all');
    try {
      await stop();
      const result = await storageService.deleteAllConversationData();
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      await refreshConversationLists();
      setStorageNotice(`Deleted ${String(result.deletedConversations)} saved conversation(s).`);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const updateRetentionPolicy = async (policy: RetentionPolicy) => {
    try {
      setRetentionPolicyState(policy);
      const result = await storageService.setRetentionPolicy(policy);
      await refreshConversationLists();
      setStorageNotice(
        `Retention cleanup removed ${String(result.removedConversations)} conversation(s).`,
      );
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const retryStorage = async () => {
    setStorageError(null);
    setLoadingStorage(true);
    try {
      const status = await storageService.status();
      setStorageStatus(status);
      if (!status.available) {
        setStorageError(status.error ?? normalizeStorageError('Storage unavailable.'));
        return;
      }
      await refreshDiagnostics();
      await refreshConversationLists();
      setStorageNotice('Storage rechecked.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    } finally {
      setLoadingStorage(false);
    }
  };

  const runRetentionCleanup = async () => {
    try {
      const result = await storageService.applyRetentionCleanup();
      await refreshConversationLists();
      setStorageNotice(
        `Retention cleanup removed ${String(result.removedConversations)} conversation(s).`,
      );
      return result;
    } catch (error) {
      setStorageError(normalizeStorageError(error));
      return null;
    }
  };

  const simulateInterruptedMessage = async () => {
    try {
      const result = await storageService.createDevelopmentInterruptedFixture();
      await refreshConversationLists();
      await refreshDiagnostics();
      setStorageNotice(
        `Created interrupted-message fixture in conversation ${result.conversationId}. Restart to verify recovery.`,
      );
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const generateMemoryFixtures = async (count: number) => {
    try {
      const result = await storageService.createDevelopmentMemoryFixtures(count);
      await refreshDiagnostics();
      setStorageNotice(`Created ${String(result.createdMemories)} memory fixture(s).`);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const deleteMemoryFixtures = async () => {
    try {
      const result = await storageService.deleteDevelopmentMemoryFixtures();
      await refreshDiagnostics();
      setStorageNotice(`Deleted ${String(result.deletedMemories)} memory fixture(s).`);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const retrieveMemoryLabResults = async (query: string) => {
    return storageService.retrieveMemories({
      query,
      limit: 8,
      includeSensitive: false,
    });
  };

  const generateJournalFixtures = async (count: number) => {
    try {
      const result = await storageService.createDevelopmentJournalFixtures(count);
      await refreshDiagnostics();
      setStorageNotice(`Created ${String(result.createdEntries)} journal fixture(s).`);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const deleteJournalFixtures = async () => {
    try {
      const result = await storageService.deleteDevelopmentJournalFixtures();
      await refreshDiagnostics();
      setStorageNotice(`Deleted ${String(result.deletedEntries)} journal fixture(s).`);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const searchJournalLabResults = async (query: string): Promise<JournalEntrySummary[]> => {
    return storageService.listJournalEntries({
      query,
      includePrivate: true,
      includeDiscarded: false,
      sort: 'newest',
      limit: 8,
      offset: 0,
    });
  };

  const exportConversations = async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    try {
      const result = await storageService.exportConversations();
      if (result) {
        setLastExport(result);
        setStorageNotice(
          `Exported ${String(result.exportedConversations)} conversation(s) to ${result.fileName}.`,
        );
      } else {
        setStorageNotice('Export cancelled. No file was written.');
      }
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    } finally {
      setExporting(false);
    }
  };

  const confirmPendingMemory = async (memory: Memory) => {
    try {
      await storageService.confirmMemory(memory.id);
      setPendingMemory(null);
      setBuddyState('happy');
      setStorageNotice('Memory confirmed. Buddy may use it when relevant.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const editPendingMemory = async (memory: Memory) => {
    const content = window.prompt('Edit memory before saving', memory.content);
    if (content === null) {
      return;
    }
    try {
      const updated = await storageService.updateMemoryContent({
        memoryId: memory.id,
        content,
        category: memory.category,
        sensitivity: memory.sensitivity,
        expiresAt: memory.expiresAt,
      });
      setPendingMemory(updated);
      setBuddyState('idle');
      setStorageNotice('Memory proposal edited. Confirm it when ready.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const rejectPendingMemory = async (memory: Memory) => {
    try {
      await storageService.rejectMemory(memory.id);
      setPendingMemory(null);
      setBuddyState('idle');
      setStorageNotice('Memory proposal dismissed. Buddy will not use it.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const models = providerStatus.status === 'connected' ? providerStatus.models : [];
  const canSend =
    canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength) &&
    (mode === 'temporary' || storageStatus?.available === true);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const visibleConversations = showArchived ? archivedConversations : conversations;
  const storageLocationSummary = summarizeDatabaseLocation(storageDiagnostics);
  const exportDestinationSummary = summarizeExportDestination(lastExport);
  const storageAvailable = storageStatus?.available === true;

  return (
    <div className="chat-shell">
      <aside className="conversation-sidebar" aria-label="Conversations">
        <div className="conversation-sidebar__actions">
          <button type="button" onClick={startNewPersistentChat} disabled={busyAction !== null}>
            New chat
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={mode === 'temporary' ? exitTemporaryChat : startTemporaryChat}
            aria-pressed={mode === 'temporary'}
            disabled={busyAction !== null}
          >
            {mode === 'temporary' ? 'Exit temporary' : 'Temporary chat'}
          </button>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setShowArchived((value) => !value);
          }}
        >
          {showArchived ? 'Show active' : 'Show archived'}
        </button>
        <div className="conversation-list" aria-live="polite">
          {loadingStorage ? <p className="muted">Loading conversations…</p> : null}
          {!storageAvailable && !loadingStorage ? (
            <p className="muted">Saved conversation list is unavailable.</p>
          ) : null}
          {visibleConversations.length === 0 && !loadingStorage ? (
            <p className="muted">
              {showArchived ? 'No archived conversations.' : 'No saved chats yet.'}
            </p>
          ) : null}
          {visibleConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`conversation-list__item${
                conversation.id === activeConversationId ? ' conversation-list__item--active' : ''
              }`}
              aria-current={conversation.id === activeConversationId ? 'page' : undefined}
              aria-label={
                showArchived
                  ? `Restore ${conversation.title}`
                  : `Open ${conversation.title}, ${readableConversationTime(conversation)}`
              }
              disabled={busyAction !== null}
              onClick={() =>
                showArchived
                  ? void restoreConversation(conversation.id)
                  : void loadConversation(conversation.id)
              }
            >
              <span className="conversation-list__item-heading">
                <strong>{conversation.title}</strong>
                <time dateTime={conversation.lastMessageAt ?? conversation.updatedAt}>
                  {readableConversationTime(conversation)}
                </time>
              </span>
              <span>{conversation.lastMessagePreview ?? 'No message preview yet'}</span>
              {showArchived ? <em>Click to restore</em> : null}
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-workspace">
        <LocalAiStatusPanel status={providerStatus} onRetry={() => void refreshModels()} />

        <div className="conversation-toolbar">
          <div>
            <p className="eyebrow">{mode === 'temporary' ? 'Temporary chat' : 'Saved locally'}</p>
            <h2>
              {mode === 'temporary'
                ? 'Temporary chat'
                : (activeConversation?.title ?? 'New conversation')}
            </h2>
            {mode === 'temporary' ? (
              <p className="temporary-explainer">
                Temporary mode is in-memory only. Messages here are not written to the local
                database and will disappear when you leave this mode or quit the app.
              </p>
            ) : null}
          </div>
          {mode === 'persistent' ? (
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void renameActiveConversation()}
                disabled={!activeConversationId || busyAction !== null}
              >
                Rename
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void archiveActiveConversation()}
                disabled={!activeConversationId || busyAction !== null}
              >
                Archive
              </button>
              <button
                type="button"
                className="stop-button"
                onClick={() => void deleteActiveConversation()}
                disabled={!activeConversationId || busyAction !== null}
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="button-row temporary-actions">
              <span className="temporary-pill">Not saved</span>
              <button type="button" className="secondary-button" onClick={exitTemporaryChat}>
                Exit temporary
              </button>
            </div>
          )}
        </div>

        {providerStatus.status === 'connected' ? (
          <ModelSelector
            models={models}
            selectedModel={session.selectedModel}
            thinking={thinking}
            disabled={session.status === 'generating'}
            onSelect={(model) => {
              dispatch({ type: 'select_model', model });
              if (model) {
                selectedModelRef.current = model;
                void storageService.setSelectedModel(model).catch((error: unknown) => {
                  setStorageError(normalizeStorageError(error));
                });
              }
            }}
            onThinkingChange={setThinking}
          />
        ) : null}

        {storageError ? (
          <div className="chat-error storage-error" role="alert">
            <strong>Storage issue</strong>
            <span>{storageError.userMessage}</span>
            {storageError.retryable ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => void retryStorage()}
              >
                Retry storage
              </button>
            ) : null}
            {import.meta.env.DEV && storageError.technicalMessage ? (
              <details>
                <summary>Technical details</summary>
                <pre>{storageError.technicalMessage}</pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {storageNotice ? <div className="storage-notice">{storageNotice}</div> : null}

        {pendingMemory ? (
          <MemoryProposalCard
            memory={pendingMemory}
            onRemember={confirmPendingMemory}
            onEdit={editPendingMemory}
            onReject={rejectPendingMemory}
          />
        ) : null}

        {usedMemories.length > 0 ? (
          <details className="memory-used-indicator">
            <summary>Used {String(usedMemories.length)} confirmed memories</summary>
            <ul>
              {usedMemories.map((memory) => (
                <li key={memory.id}>
                  <span>{memory.category.replaceAll('_', ' ')}</span>
                  {memory.content}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <MessageList messages={session.messages} generating={session.status === 'generating'} />

        {session.error ? (
          <div className="chat-error" role="alert">
            <strong>Generation stopped</strong>
            <span>{session.error.userMessage}</span>
            {import.meta.env.DEV && session.error.technicalMessage ? (
              <details>
                <summary>Technical details</summary>
                <pre>{session.error.technicalMessage}</pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {session.thinkingReceived && import.meta.env.DEV ? (
          <div className="thinking-received">Thinking data received and intentionally hidden.</div>
        ) : null}

        <ChatComposer
          input={input}
          maxLength={LOCAL_AI_CONFIG.maxInputLength}
          canSend={canSend}
          generating={session.status === 'generating'}
          onInput={handleInput}
          onSend={send}
          onStop={() => void stop()}
          onClear={clear}
        />

        <details className="privacy-panel">
          <summary>Privacy and storage</summary>
          <p>
            Conversations are stored in a local SQLite database on this computer. The database is
            not yet application-level encrypted; operating-system disk encryption may provide
            separate protection.
          </p>
          <p>
            Exports are local JSON files. They stay on this computer unless you choose to share or
            move them.
          </p>
          <dl>
            <dt>Storage status</dt>
            <dd>{storageAvailable ? 'Available' : 'Unavailable'}</dd>
            <dt>Database</dt>
            <dd>{storageLocationSummary}</dd>
            <dt>Schema</dt>
            <dd>
              {storageDiagnostics?.schemaVersion ?? storageStatus?.schemaVersion ?? 'Unknown'}
            </dd>
            <dt>Saved conversations</dt>
            <dd>
              {storageDiagnostics
                ? `${String(storageDiagnostics.activeConversationCount)} active, ${String(
                    storageDiagnostics.archivedConversationCount,
                  )} archived`
                : 'Unknown'}
            </dd>
            <dt>Saved messages</dt>
            <dd>{storageDiagnostics?.messageCount ?? 'Unknown'}</dd>
            <dt>Encryption</dt>
            <dd>Not application-level encrypted yet</dd>
            <dt>Retention</dt>
            <dd>
              <select
                value={retentionPolicy}
                disabled={!storageAvailable}
                onChange={(event) =>
                  void updateRetentionPolicy(event.currentTarget.value as RetentionPolicy)
                }
              >
                <option value="keep_until_delete">Keep until I delete</option>
                <option value="delete_after_30_days">Delete after 30 days</option>
                <option value="delete_after_90_days">Delete after 90 days</option>
              </select>
            </dd>
            <dt>Last cleanup</dt>
            <dd>{storageDiagnostics?.lastSuccessfulRetentionCleanupAt ?? 'Not recorded yet'}</dd>
            <dt>Temporary chat</dt>
            <dd>{mode === 'temporary' ? 'On - not saved' : 'Off'}</dd>
          </dl>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void exportConversations()}
              disabled={!storageAvailable || exporting}
            >
              {exporting ? 'Exporting…' : 'Export conversations'}
            </button>
            <button
              type="button"
              className="stop-button"
              onClick={() => void clearAllData()}
              disabled={!storageAvailable || busyAction !== null}
            >
              Delete all conversation data
            </button>
          </div>
          <p className="muted">Last export: {exportDestinationSummary}</p>
          <p className="muted">
            Deletion reduces recoverability with SQLite secure delete, WAL checkpointing, and
            vacuuming, but SSD behavior, OS caches, backups, and filesystem snapshots may still
            retain historical data.
          </p>
        </details>

        {storageAvailable ? (
          <>
            <JournalPanel
              storageService={storageService}
              onNotice={setStorageNotice}
              onError={setStorageError}
            />
            <MemoryPanel
              storageService={storageService}
              onNotice={setStorageNotice}
              onError={setStorageError}
            />
          </>
        ) : null}

        {import.meta.env.DEV ? (
          <>
            <StorageLab
              diagnostics={storageDiagnostics}
              activeConversationId={activeConversationId}
              activeRequestId={session.activeRequestId}
              retentionPolicy={retentionPolicy}
              storageError={storageError}
              onRefresh={() => {
                void refreshDiagnostics();
              }}
              onRunRetention={runRetentionCleanup}
              onSimulateInterrupted={simulateInterruptedMessage}
            />
            <MemoryLab
              diagnostics={memoryDiagnostics}
              onRefresh={() => {
                void refreshDiagnostics();
              }}
              onGenerateFixtures={generateMemoryFixtures}
              onDeleteFixtures={deleteMemoryFixtures}
              onRetrieve={retrieveMemoryLabResults}
            />
            <JournalLab
              diagnostics={journalDiagnostics}
              onRefresh={() => {
                void refreshDiagnostics();
              }}
              onGenerateFixtures={generateJournalFixtures}
              onDeleteFixtures={deleteJournalFixtures}
              onSearch={searchJournalLabResults}
            />
            <BuddyLab
              buddyState={buddyState}
              activeRequestId={session.activeRequestId}
              providerStatus={providerStatus}
              selectedModel={session.selectedModel}
              onState={setBuddyState}
              onWindowAction={(action) => void companionService.send({ type: action })}
              onOpenMain={() => void windowService.openMainWindow()}
              onMockStream={() => void startGeneration('Test the mock companion stream.', 'mock')}
              onMockError={() => {
                const requestId = session.activeRequestId ?? createId('request');
                if (!session.activeRequestId) {
                  const userMessage = createChatMessage('user', 'Simulate a provider error.');
                  const assistantMessage = createChatMessage('assistant', '');
                  activeRequestRef.current = requestId;
                  dispatch({
                    type: 'start_generation',
                    requestId,
                    userMessage,
                    assistantMessage,
                  });
                }
                handleStreamEvent({
                  type: 'failed',
                  requestId,
                  error: simulatedError(),
                });
              }}
              onMockCancel={() => void stop()}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function simulatedError(): LocalAiError {
  return {
    code: 'generation_failed',
    userMessage: 'This is a simulated local provider error.',
    technicalMessage: 'Buddy Lab requested a deterministic error.',
    retryable: true,
  };
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}
