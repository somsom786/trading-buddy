import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { buddyStateForLifecycle, type BuddyState } from '../../domain/companion/buddyState';
import {
  conversationModePrompt,
  detectConversationMode,
} from '../../domain/companion/conversationMode';
import {
  COMPANION_IDENTITY_PROMPT,
  companionStatePrompt,
  identityStateForMode,
} from '../../domain/companion/identity';
import { buildContextBudget } from '../../domain/continuity/budget';
import type { ContinuityRetrievalItem, SemanticMemoryStatus } from '../../domain/continuity/types';
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
import {
  tauriContinuityService,
  type ContinuityService,
} from '../../services/tauri/continuityService';
import { tauriWindowService, type WindowService } from '../../services/windowService';
import {
  buildMemoryContextForMessage,
  handleExplicitMemoryIntent,
  handleForgetMemoryIntent,
  runBackgroundMemoryExtraction,
} from '../../services/memoryWorkflow';
import { BuddyLab } from '../local-ai/BuddyLab';
import { CreatureLab } from '../local-ai/CreatureLab';
import { CreatureMovementSettings } from '../buddy/CreatureMovementSettings';
import { JournalLab } from '../local-ai/JournalLab';
import { ContinuityLab } from '../local-ai/ContinuityLab';
import { MemoryLab } from '../local-ai/MemoryLab';
import { StorageLab } from '../local-ai/StorageLab';
import { TradingLab } from '../local-ai/TradingLab';
import { ChatComposer } from './ChatComposer';
import { LocalAiStatusPanel } from './LocalAiStatusPanel';
import { MessageList } from './MessageList';
import { ModelSelector } from './ModelSelector';
import { MemoryPanel } from '../memory/MemoryPanel';
import { MemoryProposalCard } from '../memory/MemoryProposalCard';
import { JournalPanel } from '../journal/JournalPanel';
import { TradingPanel } from '../trading/TradingPanel';
import { ContinuityPanel } from '../continuity/ContinuityPanel';
import type { JournalDiagnostics, JournalEntrySummary } from '../../domain/journal/types';
import type { Memory, MemoryDiagnostics, RetrievedMemory } from '../../domain/memory/types';
import {
  agentMessageToChatMessage,
  buildHiddenCompanionContext,
} from '../../domain/agent-session/presentation';
import { SupportModePicker } from '../../features/agent-session/SupportModePicker';
import { useAgentSession } from '../../features/agent-session/useAgentSession';
import { AgentSessionLab } from '../../features/agent-session/AgentSessionLab';
import {
  tauriAgentSessionService,
  type AgentSessionService,
} from '../../services/tauri/agentSessionService';

const CHECKPOINT_CHAR_THRESHOLD = 500;
const CHECKPOINT_INTERVAL_MS = 1_200;

interface ChatWorkspaceProps {
  localAiService?: LocalAiService;
  storageService?: StorageService;
  companionService?: CompanionService;
  windowService?: WindowService;
  continuityService?: ContinuityService;
  agentSessionService?: AgentSessionService;
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
  continuityItems: ContinuityRetrievalItem[];
}

interface PendingPostTurn {
  content: string;
  model: string;
  conversationOptedOut: boolean;
  memoryIds: string[];
  continuityItems: ContinuityRetrievalItem[];
}

export function ChatWorkspace({
  localAiService = tauriLocalAiService,
  storageService = tauriStorageService,
  companionService = tauriCompanionService,
  windowService = tauriWindowService,
  continuityService = tauriContinuityService,
  agentSessionService = tauriAgentSessionService,
}: ChatWorkspaceProps) {
  const agentSession = useAgentSession(agentSessionService);
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
  const [usedContinuity, setUsedContinuity] = useState<ContinuityRetrievalItem[]>([]);
  const [semanticStatus, setSemanticStatus] = useState<SemanticMemoryStatus>('lexical_memory_mode');
  const [conversationMemoryOptOut, setConversationMemoryOptOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const nativeRequestInFlightRef = useRef(false);
  const selectedModelRef = useRef<string | null>(null);
  const requestKindRef = useRef<'real' | 'mock' | null>(null);
  const mockRunRef = useRef<{ requestId: string; cancelled: boolean } | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const assistantPersistenceRef = useRef<ActiveAssistantPersistence | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const pendingPostTurnRef = useRef<PendingPostTurn | null>(null);

  useEffect(() => {
    activeRequestRef.current = agentSession.snapshot.activeRequestId ?? session.activeRequestId;
    selectedModelRef.current = session.selectedModel;
  }, [agentSession.snapshot.activeRequestId, session.activeRequestId, session.selectedModel]);

  useEffect(() => {
    void agentSessionService.start().catch(() => undefined);
  }, [agentSessionService]);

  useEffect(() => {
    if (
      agentSession.snapshot.turnStatus === 'failed' ||
      agentSession.snapshot.turnStatus === 'cancelled'
    ) {
      pendingPostTurnRef.current = null;
      return;
    }
    if (agentSession.snapshot.turnStatus !== 'completed' || !pendingPostTurnRef.current) {
      return;
    }
    const pending = pendingPostTurnRef.current;
    pendingPostTurnRef.current = null;
    const storedUser = [...agentSession.snapshot.messages]
      .reverse()
      .find((message) => message.role === 'user');
    const storedAssistant = [...agentSession.snapshot.messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status === 'completed');
    const completedConversationId = agentSession.snapshot.localConversationId;
    if (!agentSession.snapshot.temporary && completedConversationId && storedAssistant) {
      if (pending.memoryIds.length > 0) {
        void storageService.recordMemoryUsage({
          memoryIds: pending.memoryIds,
          conversationId: completedConversationId,
          assistantMessageId: storedAssistant.id,
          reasonCode: 'home_chat_context',
        });
      }
      if (pending.continuityItems.length > 0) {
        void continuityService.recordUsage({
          conversationId: completedConversationId,
          assistantMessageId: storedAssistant.id,
          items: pending.continuityItems,
        });
      }
      void storageService
        .getSettings()
        .then((settings) =>
          settings.continuityPreferences.consolidationEnabled
            ? continuityService.enqueue(completedConversationId)
            : null,
        )
        .catch(() => undefined);
    }
    void storageService
      .getSettings()
      .then((settings) =>
        runBackgroundMemoryExtraction({
          storageService,
          localAiService,
          content: pending.content,
          model: pending.model,
          requestId: createId('memory_request'),
          sourceConversationId: agentSession.snapshot.temporary
            ? undefined
            : (agentSession.snapshot.localConversationId ?? undefined),
          sourceMessageId: agentSession.snapshot.temporary ? undefined : storedUser?.id,
          temporaryChat: agentSession.snapshot.temporary,
          conversationOptedOut: pending.conversationOptedOut,
          preferences: settings.memoryPreferences,
        }),
      )
      .catch((error: unknown) => {
        setStorageError(normalizeStorageError(error));
      });
  }, [
    agentSession.snapshot.localConversationId,
    agentSession.snapshot.messages,
    agentSession.snapshot.temporary,
    agentSession.snapshot.turnStatus,
    localAiService,
    continuityService,
    storageService,
  ]);

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
        await agentSessionService.open({
          localConversationId: conversationId,
          model: selectedModelRef.current ?? LOCAL_AI_CONFIG.recommendedModel,
          temporary: false,
        });
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    },
    [agentSessionService, confirmLeavingTemporary, storageService],
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
          const detail = await storageService.getConversation(target.id);
          dispatch({
            type: 'load_session',
            conversationId: target.id,
            messages: detail.messages.map(storedMessageToChatMessage),
          });
          setMode('persistent');
          setActiveConversationId(target.id);
          setConversationMemoryOptOut(false);
          await storageService.setLastOpenedConversation(target.id);
          await agentSessionService.open({
            localConversationId: target.id,
            model: settings.selectedLocalModel ?? LOCAL_AI_CONFIG.recommendedModel,
            temporary: false,
          });
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
  }, [agentSessionService, refreshConversationLists, storageService]);

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
      const persistedSelection =
        selectedModelRef.current ??
        (await storageService
          .getSettings()
          .then((settings) => settings.selectedLocalModel ?? null)
          .catch(() => null));
      const selectedModel = selectPreferredModel(models, persistedSelection);
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
          if (persistence.continuityItems.length > 0) {
            await continuityService.recordUsage({
              conversationId: persistence.conversationId,
              assistantMessageId: persistence.messageId,
              items: persistence.continuityItems,
            });
          }
          assistantPersistenceRef.current = null;
          void storageService
            .getSettings()
            .then((settings) =>
              settings.continuityPreferences.consolidationEnabled
                ? continuityService.enqueue(persistence.conversationId)
                : null,
            )
            .catch(() => undefined);
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
    [continuityService, refreshConversationLists, storageService],
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
      if (
        activeRequestRef.current ||
        nativeRequestInFlightRef.current ||
        (requestMode === 'real' && !session.selectedModel)
      ) {
        return;
      }
      const requestId = createId('request');
      const selectedModel = session.selectedModel ?? LOCAL_AI_CONFIG.recommendedModel;
      let conversationId = session.id;
      const userMessage = createChatMessage('user', content);
      const assistantMessage = createChatMessage('assistant', '');
      let memoryContext: string | null = null;
      let memoryIds: string[] = [];
      let continuityItems: ContinuityRetrievalItem[] = [];
      let memoryOptedOutForRequest = conversationMemoryOptOut;
      let memoryNotice: string | null = null;

      if (requestMode === 'real' && mode === 'persistent') {
        conversationId = activeConversationId ?? conversationId;
      } else if (requestMode === 'mock') {
        assistantPersistenceRef.current = {
          mode: 'temporary',
          conversationId,
          messageId: assistantMessage.id,
          requestId,
          content: '',
          lastSavedLength: 0,
          memoryIds: [],
          continuityItems: [],
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
          memoryIds = retrievedMemories.map((memory) => memory.id);
          setUsedMemories(retrievedMemories);
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

      if (requestMode === 'real' && mode === 'persistent') {
        try {
          const continuity = await continuityService.retrieve({ query: content, limit: 8 });
          continuityItems = continuity.items;
          setUsedContinuity(continuity.items);
          setSemanticStatus(continuity.semanticStatus);
        } catch {
          continuityItems = [];
          setUsedContinuity([]);
          setSemanticStatus('lexical_memory_mode');
        }
      } else {
        setUsedContinuity([]);
      }

      const detectedMode = detectConversationMode(content);
      const identityState = identityStateForMode(detectedMode.mode, Date.now());
      const budget = buildContextBudget({
        systemPrompt: `${COMPANION_SYSTEM_PROMPT}\n\n${COMPANION_IDENTITY_PROMPT}`,
        conversationModePrompt: conversationModePrompt(detectedMode),
        companionStatePrompt: companionStatePrompt(identityState),
        confirmedMemoryContext: memoryContext,
        continuityItems,
        recentMessages: session.messages.map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
        currentUserMessage: content,
        recentMessageLimit: 12,
      });
      if (requestMode === 'real') {
        const hiddenContext = buildHiddenCompanionContext(
          budget.messages
            .slice(0, -1)
            .map((message) => `${message.role.toUpperCase()}:\n${message.content}`),
        );
        activeRequestRef.current = requestId;
        setInput('');
        setStorageError(null);
        setStorageNotice(memoryNotice);
        setBuddyState(buddyStateForLifecycle('message_submitted'));
        pendingPostTurnRef.current = {
          content,
          model: selectedModel,
          conversationOptedOut: memoryOptedOutForRequest,
          memoryIds,
          continuityItems,
        };
        try {
          const next = await agentSessionService.submit({
            localConversationId: mode === 'persistent' ? activeConversationId : null,
            requestId,
            turnId: createId('turn'),
            text: content,
            model: selectedModel,
            temporary: mode === 'temporary',
            hiddenContext,
          });
          setActiveConversationId(next.temporary ? null : next.localConversationId);
          await refreshConversationLists();
        } catch (error) {
          pendingPostTurnRef.current = null;
          setStorageError(normalizeStorageError(error));
        }
        return;
      }
      activeRequestRef.current = requestId;
      requestKindRef.current = requestMode;
      mockRunRef.current = { requestId, cancelled: false };
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

      const mockEvents: LocalChatEvent[] = [
        { type: 'started', requestId },
        { type: 'content_delta', requestId, content: 'This is a ' },
        { type: 'content_delta', requestId, content: 'local mock stream. ' },
        { type: 'content_delta', requestId, content: 'No Ollama request was made.' },
        { type: 'completed', requestId },
      ];
      for (const event of mockEvents) {
        await delay(180);
        if (mockRunRef.current.requestId === requestId && mockRunRef.current.cancelled) {
          handleStreamEvent({ type: 'cancelled', requestId });
          return;
        }
        handleStreamEvent(event);
      }
    },
    [
      activeConversationId,
      agentSessionService,
      conversationMemoryOptOut,
      continuityService,
      handleStreamEvent,
      mode,
      refreshConversationLists,
      session.id,
      session.messages,
      session.selectedModel,
      setBuddyState,
      storageService,
    ],
  );

  const send = () => {
    const validation = validateMessageInput(input, LOCAL_AI_CONFIG.maxInputLength);
    if (validation.valid && canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength)) {
      void startGeneration(validation.content, 'real');
    }
  };

  const stop = useCallback(async () => {
    if (agentSession.snapshot.activeRequestId) {
      await agentSession.interrupt();
      return;
    }
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
  }, [agentSession, handleStreamEvent, localAiService]);

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
    void agentSessionService.close();
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
    void agentSessionService.close();
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
    void agentSessionService.close();
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
      const runtimePurged = await agentSessionService
        .purgeConversation(activeConversationId)
        .catch(() => false);
      await storageService.deleteConversation(activeConversationId);
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      const { active } = await refreshConversationLists();
      if (active[0]) {
        await loadConversation(active[0].id);
      }
      setStorageNotice(
        runtimePurged
          ? 'Conversation and its isolated agent session were deleted.'
          : 'Conversation deleted locally. The offline agent cache could not be verified.',
      );
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
      const runtimePurged = await agentSessionService
        .purgeAll()
        .then(() => true)
        .catch(() => false);
      const result = await storageService.deleteAllConversationData();
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      await refreshConversationLists();
      setStorageNotice(
        `Deleted ${String(result.deletedConversations)} saved conversation(s).${
          runtimePurged ? '' : ' The offline agent cache could not be verified.'
        }`,
      );
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
  const sharedMessages = agentSession.snapshot.messages.map(agentMessageToChatMessage);
  const displayedMessages = sharedMessages.length > 0 ? sharedMessages : session.messages;
  const sharedGenerating = agentSession.snapshot.activeRequestId !== null;
  const latestSharedAssistant = [...agentSession.snapshot.messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const canSend =
    canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength) &&
    !sharedGenerating &&
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
            disabled={sharedGenerating || session.status === 'generating'}
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

        {usedContinuity.length > 0 ? (
          <details className="memory-used-indicator">
            <summary>
              Used {String(usedContinuity.length)} continuity items ·{' '}
              {semanticStatus.replaceAll('_', ' ')}
            </summary>
            <ul>
              {usedContinuity.map((item) => (
                <li key={`${item.sourceType}:${item.sourceId}`}>
                  <span>{item.sourceType.replaceAll('_', ' ')}</span>
                  {item.content}
                  <small>Why: {item.reasonCodes.join(', ')}</small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <SupportModePicker
          value={agentSession.snapshot.supportMode}
          disabled={agentSession.loading}
          onChange={(supportMode) => {
            void agentSession.setSupportMode(supportMode);
          }}
        />

        {latestSharedAssistant && !sharedGenerating ? (
          <div className="button-row agent-response-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void agentSession.retry({
                  requestId: createId('request'),
                  turnId: createId('turn'),
                  model: session.selectedModel ?? LOCAL_AI_CONFIG.recommendedModel,
                  hiddenContext: '',
                })
              }
            >
              Retry response
            </button>
          </div>
        ) : null}

        <MessageList
          messages={displayedMessages}
          generating={sharedGenerating || session.status === 'generating'}
        />

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
          generating={sharedGenerating || session.status === 'generating'}
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
            <CreatureMovementSettings
              storageService={storageService}
              companionService={companionService}
              onNotice={setStorageNotice}
              onError={setStorageError}
            />
            <MemoryPanel
              storageService={storageService}
              onNotice={setStorageNotice}
              onError={setStorageError}
            />
            <JournalPanel
              storageService={storageService}
              onNotice={setStorageNotice}
              onError={setStorageError}
            />
            <ContinuityPanel
              activeConversationId={activeConversationId}
              continuityService={continuityService}
              storageService={storageService}
              onNotice={setStorageNotice}
              onError={setStorageError}
            />
            <section className="skills-surface" aria-labelledby="skills-surface-title">
              <header>
                <p className="eyebrow">Optional capabilities</p>
                <h2 id="skills-surface-title">Skills</h2>
                <p>
                  Skills add focused tools without defining Buddy’s identity or entering unrelated
                  conversations.
                </p>
              </header>
              <TradingPanel />
            </section>
          </>
        ) : null}

        {import.meta.env.DEV ? (
          <>
            <AgentSessionLab snapshot={agentSession.snapshot} service={agentSessionService} />
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
            <TradingLab />
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
            <CreatureLab companionService={companionService} />
            <ContinuityLab
              activeConversationId={activeConversationId}
              continuityService={continuityService}
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
