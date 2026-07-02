import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { buddyStateForLifecycle } from '../domain/companion/buddyState';
import {
  conversationModePrompt,
  detectConversationMode,
} from '../domain/companion/conversationMode';
import {
  COMPANION_IDENTITY_PROMPT,
  companionStatePrompt,
  identityStateForMode,
} from '../domain/companion/identity';
import { buildContextBudget } from '../domain/continuity/budget';
import type { ContinuityRetrievalItem, SemanticMemoryStatus } from '../domain/continuity/types';
import {
  conversationReducer,
  createChatMessage,
  createConversationSession,
  createId,
  validateMessageInput,
} from '../domain/conversation/session';
import { LOCAL_AI_CONFIG } from '../domain/local-ai/config';
import { COMPANION_SYSTEM_PROMPT } from '../domain/local-ai/systemPrompt';
import { buildTradingContext } from '../domain/trading/context';
import { readOnlyExecutionRefusal } from '../domain/trading/formatting';
import { detectTradingIntent, type TradingIntent } from '../domain/trading/intents';
import { type LocalChatEvent } from '../domain/local-ai/types';
import { AGENT_PROVIDER_CONFIG } from '../domain/agent-session/provider';
import type { AgentConnectionStatus } from '../domain/agent-session/types';
import {
  normalizeStorageError,
  storedMessageToChatMessage,
  type AssistantMessageFailure,
  type AssistantMessageUpdate,
  type StorageError,
  type StorageStatus,
} from '../domain/storage/types';
import type { Memory, RetrievedMemory } from '../domain/memory/types';
import { tauriCompanionService, type CompanionService } from '../services/tauri/companionService';
import { tauriLocalAiService, type LocalAiService } from '../services/tauri/localAiService';
import { tauriStorageService, type StorageService } from '../services/tauri/storageService';
import {
  tauriContinuityService,
  type ContinuityService,
} from '../services/tauri/continuityService';
import { tauriWindowService, type WindowService } from '../services/windowService';
import { loadActiveTradingAccountId } from '../services/tradingRuntimeStore';
import { fetchTradingFacts } from '../services/tradingFacts';
import { tauriTradingService, type TradingService } from '../services/tauri/tradingService';
import {
  buildMemoryContextForMessage,
  handleExplicitMemoryIntent,
  handleForgetMemoryIntent,
  runBackgroundMemoryExtraction,
} from '../services/memoryWorkflow';
import { MemoryProposalCard } from '../components/memory/MemoryProposalCard';
import { JournalSessionCard } from '../components/journal/JournalSessionCard';
import { TradingBubblePanel } from '../components/trading/TradingBubblePanel';
import { journalPromptsForKind, supportModeOpening } from '../domain/journal/flows';
import { detectJournalIntent } from '../domain/journal/intent';
import { assessJournalSafety } from '../domain/journal/safety';
import {
  createIdleJournalSession,
  journalSessionReducer,
  journalSessionToDraft,
  sessionHasMeaningfulContent,
} from '../domain/journal/session';
import type { JournalKind, JournalMode } from '../domain/journal/types';
import {
  DEFAULT_PET_SKIN,
  loadSelectedPetSkin,
  saveSelectedPetSkin,
  type PetSkinSelection,
} from '../domain/petdex/skins';
import { fetchFeaturedPetdexSkins } from '../services/petdexCatalog';
import {
  agentMessageToChatMessage,
  buildHiddenCompanionContext,
} from '../domain/agent-session/presentation';
import { SupportModePicker } from '../features/agent-session/SupportModePicker';
import { useAgentSession } from '../features/agent-session/useAgentSession';
import {
  tauriAgentSessionService,
  type AgentSessionService,
} from '../services/tauri/agentSessionService';

type PersistenceMode = 'persistent' | 'temporary';

const READ_ONLY_TRADING_RULES = `READ-ONLY TRADING RULES

- Use only the supplied account facts.
- Treat missing values as unavailable.
- Do not invent prices, balances, PnL, leverage, or order state.
- Do not calculate authoritative financial results.
- Do not recommend buying, selling, leverage, or position changes.
- Do not predict market movement.
- Trading Buddy cannot place, close, cancel, or modify trades.
- Mention stale, saved, fixture, or partial data when relevant.`;

interface BubbleViewProps {
  localAiService?: LocalAiService;
  storageService?: StorageService;
  companionService?: CompanionService;
  windowService?: WindowService;
  tradingService?: TradingService;
  continuityService?: ContinuityService;
  petdexCatalog?: () => Promise<PetSkinSelection[]>;
  agentSessionService?: AgentSessionService;
}

interface ActiveAssistantPersistence {
  mode: PersistenceMode;
  conversationId: string;
  messageId: string;
  requestId: string;
  content: string;
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

export function BubbleView({
  localAiService = tauriLocalAiService,
  storageService = tauriStorageService,
  companionService = tauriCompanionService,
  windowService = tauriWindowService,
  tradingService = tauriTradingService,
  continuityService = tauriContinuityService,
  petdexCatalog = fetchFeaturedPetdexSkins,
  agentSessionService = tauriAgentSessionService,
}: BubbleViewProps) {
  const agentSession = useAgentSession(agentSessionService);
  const [session, dispatch] = useReducer(conversationReducer, undefined, () =>
    createConversationSession(),
  );
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<PersistenceMode>('persistent');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [pendingMemory, setPendingMemory] = useState<Memory | null>(null);
  const [usedMemories, setUsedMemories] = useState<RetrievedMemory[]>([]);
  const [usedContinuity, setUsedContinuity] = useState<ContinuityRetrievalItem[]>([]);
  const [semanticStatus, setSemanticStatus] = useState<SemanticMemoryStatus>('lexical_memory_mode');
  const [conversationMemoryOptOut, setConversationMemoryOptOut] = useState(false);
  const [journalSession, setJournalSession] = useState(createIdleJournalSession);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const [petSkins, setPetSkins] = useState<PetSkinSelection[]>([DEFAULT_PET_SKIN]);
  const [selectedPetSkin, setSelectedPetSkin] = useState<PetSkinSelection>(() =>
    loadSelectedPetSkin(),
  );
  const [petSkinStatus, setPetSkinStatus] = useState<'idle' | 'loading' | 'ready' | 'offline'>(
    'idle',
  );
  const activeRequestRef = useRef<string | null>(null);
  const nativeRequestInFlightRef = useRef(false);
  const selectedModelRef = useRef<string | null>(AGENT_PROVIDER_CONFIG.model);
  const persistenceRef = useRef<ActiveAssistantPersistence | null>(null);
  const pendingPostTurnRef = useRef<PendingPostTurn | null>(null);

  useEffect(() => {
    activeRequestRef.current = agentSession.snapshot.activeRequestId ?? session.activeRequestId;
    selectedModelRef.current = session.selectedModel;
  }, [agentSession.snapshot.activeRequestId, session.activeRequestId, session.selectedModel]);

  useEffect(() => {
    selectedModelRef.current = AGENT_PROVIDER_CONFIG.model;
    dispatch({ type: 'provider_ready', selectedModel: AGENT_PROVIDER_CONFIG.model });
  }, []);

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
          reasonCode: 'bubble_chat_context',
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
    (eventState: ReturnType<typeof buddyStateForLifecycle>) => {
      void companionService.setState(eventState);
    },
    [companionService],
  );

  const dispatchJournal = useCallback((event: Parameters<typeof journalSessionReducer>[1]) => {
    setJournalSession((current) => journalSessionReducer(current, event));
  }, []);

  const startJournalSession = useCallback(
    (mode: JournalMode, kind: JournalKind) => {
      if (storageStatus?.available !== true) {
        setStorageError(normalizeStorageError('Local storage is required before journaling.'));
        return;
      }
      dispatchJournal({
        type: 'start',
        id: createId('journal_session'),
        mode,
        kind,
        now: new Date().toISOString(),
        isPrivate: true,
      });
      setStorageNotice(`${supportModeOpening('listen')} Save or discard when you are ready.`);
      setBuddyState('thinking');
    },
    [dispatchJournal, setBuddyState, storageStatus?.available],
  );

  const saveJournalSession = useCallback(
    async (status: 'draft' | 'completed') => {
      if (!sessionHasMeaningfulContent(journalSession)) {
        dispatchJournal({ type: 'error', message: 'Write a little before saving this journal.' });
        return;
      }
      dispatchJournal({ type: 'saving' });
      const safety = assessJournalSafety(journalSession.draftBody);
      const draft = journalSessionToDraft(journalSession);
      draft.status = status;
      if (safety.blockMemorySuggestion) {
        draft.allowMemoryCandidates = false;
      }
      try {
        const entry = await storageService.createJournalEntry(draft);
        dispatchJournal({ type: 'saved', entryId: entry.id });
        setStorageNotice(
          `${status === 'draft' ? 'Journal draft saved' : 'Journal entry saved'}.${
            safety.message ? ` ${safety.message}` : ''
          }`,
        );
        setBuddyState(status === 'completed' ? 'happy' : 'idle');
      } catch (error) {
        const normalized = normalizeStorageError(error);
        dispatchJournal({ type: 'error', message: normalized.userMessage });
        setStorageError(normalized);
      }
    },
    [dispatchJournal, journalSession, setBuddyState, storageService],
  );

  useEffect(() => {
    void (async () => {
      try {
        const status = await storageService.status();
        setStorageStatus(status);
        if (!status.available) {
          setStorageError(status.error ?? normalizeStorageError('Storage unavailable.'));
          return;
        }
        const settings = await storageService.getSettings();
        const lastConversationId = settings.lastOpenedConversationId;
        if (lastConversationId) {
          const detail = await storageService.getConversation(lastConversationId);
          setActiveConversationId(lastConversationId);
          dispatch({
            type: 'load_session',
            conversationId: lastConversationId,
            messages: detail.messages.map(storedMessageToChatMessage),
          });
          await agentSessionService.open({
            localConversationId: lastConversationId,
            model: AGENT_PROVIDER_CONFIG.model,
            temporary: false,
          });
        }
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    })();
  }, [agentSessionService, storageService]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        void windowService.controlBubble('hide');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [windowService]);

  const flushAssistant = useCallback(
    async (finalStatus: 'completed' | 'cancelled' | 'failed', errorCode?: string) => {
      const persistence = persistenceRef.current;
      if (persistence?.mode !== 'persistent') {
        persistenceRef.current = null;
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
              reasonCode: 'bubble_chat_context',
            });
          }
          if (persistence.continuityItems.length > 0) {
            await continuityService.recordUsage({
              conversationId: persistence.conversationId,
              assistantMessageId: persistence.messageId,
              items: persistence.continuityItems,
            });
          }
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
        } else {
          const failure: AssistantMessageFailure = {
            ...update,
            errorCode: errorCode ?? 'generation_failed',
          };
          await storageService.failAssistant(failure);
        }
        persistenceRef.current = null;
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    },
    [continuityService, storageService],
  );

  const handleStreamEvent = useCallback(
    (event: LocalChatEvent) => {
      dispatch({ type: 'stream_event', event });
      if (event.requestId !== activeRequestRef.current) {
        return;
      }
      if (event.type === 'content_delta') {
        if (persistenceRef.current?.requestId === event.requestId) {
          persistenceRef.current.content += event.content;
        }
        setBuddyState(buddyStateForLifecycle('response_started'));
      } else if (event.type === 'completed') {
        void flushAssistant('completed');
        setBuddyState(buddyStateForLifecycle('generation_completed'));
      } else if (event.type === 'cancelled') {
        void flushAssistant('cancelled');
        setBuddyState(buddyStateForLifecycle('generation_cancelled'));
      } else if (event.type === 'failed') {
        void flushAssistant('failed', event.error.code);
        setBuddyState(buddyStateForLifecycle('generation_failed'));
      }
    },
    [flushAssistant, setBuddyState],
  );

  const appendDeterministicReply = useCallback(
    (userContent: string, assistantContent: string) => {
      const requestId = createId('request');
      const userMessage = createChatMessage('user', userContent);
      const assistantMessage = createChatMessage('assistant', '');
      activeRequestRef.current = requestId;
      dispatch({
        type: 'start_generation',
        requestId,
        userMessage,
        assistantMessage,
      });
      handleStreamEvent({ type: 'content_delta', requestId, content: assistantContent });
      handleStreamEvent({ type: 'completed', requestId });
      activeRequestRef.current = null;
      setInput('');
      setBuddyState(buddyStateForLifecycle('response_started'));
    },
    [handleStreamEvent, setBuddyState],
  );

  const send = async () => {
    const validation = validateMessageInput(input, LOCAL_AI_CONFIG.maxInputLength);
    if (!validation.valid || session.activeRequestId || nativeRequestInFlightRef.current) {
      return;
    }
    const tradingIntent = detectTradingIntent(validation.content);
    const journalIntent = detectJournalIntent(validation.content);
    if (journalIntent.type === 'start_journal') {
      startJournalSession(journalIntent.mode, journalIntent.kind);
      setInput('');
      return;
    }
    if (journalIntent.type === 'discard_journal') {
      dispatchJournal({ type: 'discard' });
      setStorageNotice('Journal session discarded.');
      setInput('');
      return;
    }
    if (tradingIntent === 'unsupported_trade_execution') {
      appendDeterministicReply(validation.content, readOnlyExecutionRefusal());
      return;
    }
    if (tradingIntent === 'open_trading_home' || tradingIntent === 'connect_hyperliquid') {
      await windowService.openMainWindow();
      appendDeterministicReply(
        validation.content,
        'Opened Companion Home. Trading Buddy remains read-only and cannot execute trades.',
      );
      return;
    }
    if (tradingIntent === 'refresh_hyperliquid' || tradingIntent === 'cancel_hyperliquid_sync') {
      const accountId = await loadActiveTradingAccountId(tradingService);
      if (!accountId) {
        appendDeterministicReply(
          validation.content,
          'No Hyperliquid account is selected. Open Trading to connect or select an account.',
        );
        return;
      }
      try {
        if (tradingIntent === 'refresh_hyperliquid') {
          void tradingService.sync(accountId);
          appendDeterministicReply(
            validation.content,
            'Read-only refresh started for the selected Hyperliquid account. Use the Sync card to watch progress or stop it.',
          );
        } else {
          await tradingService.cancelSync(accountId);
          appendDeterministicReply(
            validation.content,
            'Stop requested for the selected Hyperliquid refresh. Saved data remains available.',
          );
        }
      } catch (error) {
        appendDeterministicReply(validation.content, errorMessage(error));
      }
      return;
    }
    if (!session.selectedModel) {
      if (isFactIntent(tradingIntent)) {
        const accountId = await loadActiveTradingAccountId(tradingService);
        appendDeterministicReply(
          validation.content,
          accountId
            ? 'The cloud companion is offline, but your saved account fact cards are still available below.'
            : 'The cloud companion is offline, and no Hyperliquid account is selected. Open Trading to connect or select an account.',
        );
      }
      return;
    }
    let preparedTradingContext: string | null = null;
    if (isFactIntent(tradingIntent)) {
      const accountId = await loadActiveTradingAccountId(tradingService);
      if (!accountId) {
        appendDeterministicReply(
          validation.content,
          'No Hyperliquid account is selected. Open Trading to connect or select an account.',
        );
        return;
      }
      try {
        const facts = await fetchTradingFacts(tradingService, accountId, tradingIntent);
        preparedTradingContext = buildTradingContext(
          {
            accountId,
            intent: tradingIntent,
            maximumCharacters: 2400,
            maximumPositions: 5,
            maximumFills: 5,
            maximumFundingRecords: 5,
            maximumOrders: 5,
          },
          facts,
        );
      } catch (error) {
        appendDeterministicReply(validation.content, errorMessage(error));
        return;
      }
    }
    const requestId = createId('request');
    const selectedModel = AGENT_PROVIDER_CONFIG.model;
    let conversationId = session.id;
    const assistantMessage = createChatMessage('assistant', '');
    let memoryContext: string | null = null;
    let memoryIds: string[] = [];
    let continuityItems: ContinuityRetrievalItem[] = [];
    const tradingContext: string | null = preparedTradingContext;
    let memoryOptedOutForRequest = conversationMemoryOptOut;
    let memoryNotice: string | null = null;
    const contextRetrievalStartedAt = performance.now();

    if (mode === 'persistent') {
      conversationId = activeConversationId ?? conversationId;
    } else {
      persistenceRef.current = {
        mode: 'temporary',
        conversationId,
        messageId: assistantMessage.id,
        requestId,
        content: '',
        memoryIds: [],
        continuityItems: [],
      };
    }

    if (!isFactIntent(tradingIntent)) {
      try {
        const memoryContextResult = await buildMemoryContextForMessage({
          storageService,
          content: validation.content,
          temporaryChat: mode === 'temporary',
        });
        memoryContext = memoryContextResult.context;
        memoryIds = memoryContextResult.retrieved.map((memory) => memory.id);
        setUsedMemories(memoryContextResult.retrieved);
        const forgetResult = await handleForgetMemoryIntent({
          storageService,
          content: validation.content,
        });
        if (forgetResult.notice) {
          memoryNotice = forgetResult.notice;
        }
        const proposalResult = await handleExplicitMemoryIntent({
          storageService,
          content: validation.content,
          temporaryChat: mode === 'temporary',
          sourceConversationId: mode === 'persistent' ? conversationId : undefined,
          preferences: memoryContextResult.preferences,
        });
        if (proposalResult.proposal?.status === 'proposed') {
          setPendingMemory(proposalResult.proposal);
          void companionService.setState('thinking');
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

    if (!isFactIntent(tradingIntent) && mode === 'persistent') {
      try {
        const continuity = await continuityService.retrieve({
          query: validation.content,
          limit: 8,
        });
        continuityItems = continuity.items;
        setUsedContinuity(continuity.items);
        setSemanticStatus(continuity.semanticStatus);
      } catch {
        setUsedContinuity([]);
        setSemanticStatus('lexical_memory_mode');
      }
    } else {
      setUsedContinuity([]);
    }

    const contextRetrievalMs = elapsedMilliseconds(contextRetrievalStartedAt);
    const contextBudgetStartedAt = performance.now();
    const detectedMode = detectConversationMode(validation.content);
    const identityState = identityStateForMode(detectedMode.mode, Date.now());
    const supplementalContext = [tradingContext ? READ_ONLY_TRADING_RULES : null, tradingContext]
      .filter((value): value is string => value !== null)
      .join('\n\n');
    const budget = buildContextBudget({
      systemPrompt: `${COMPANION_SYSTEM_PROMPT}\n\n${COMPANION_IDENTITY_PROMPT}`,
      conversationModePrompt: conversationModePrompt(detectedMode),
      companionStatePrompt: companionStatePrompt(identityState),
      confirmedMemoryContext:
        [supplementalContext, memoryContext]
          .filter((value): value is string => Boolean(value))
          .join('\n\n') || null,
      continuityItems,
      recentMessages: session.messages.map(({ role, content }) => ({ role, content })),
      currentUserMessage: validation.content,
      recentMessageLimit: 12,
    });
    const contextBudgetMs = elapsedMilliseconds(contextBudgetStartedAt);
    const promptConstructionStartedAt = performance.now();
    const hiddenContext = buildHiddenCompanionContext(
      budget.messages
        .slice(0, -1)
        .map((message) => `${message.role.toUpperCase()}:\n${message.content}`),
    );
    const promptConstructionMs = elapsedMilliseconds(promptConstructionStartedAt);

    activeRequestRef.current = requestId;
    setInput('');
    setStorageError(null);
    setStorageNotice(memoryNotice);
    setBuddyState(buddyStateForLifecycle('message_submitted'));
    if (!isFactIntent(tradingIntent)) {
      pendingPostTurnRef.current = {
        content: validation.content,
        model: selectedModel,
        conversationOptedOut: memoryOptedOutForRequest,
        memoryIds,
        continuityItems,
      };
    }
    try {
      const next = await agentSessionService.submit({
        localConversationId: mode === 'persistent' ? activeConversationId : null,
        requestId,
        turnId: createId('turn'),
        text: validation.content,
        model: selectedModel,
        temporary: mode === 'temporary',
        hiddenContext,
        clientTimings: {
          contextRetrievalMs,
          contextBudgetMs,
          promptConstructionMs,
        },
      });
      setActiveConversationId(next.temporary ? null : next.localConversationId);
    } catch (error) {
      pendingPostTurnRef.current = null;
      setStorageError(normalizeStorageError(error));
    }
    return;
  };

  const stop = async () => {
    if (agentSession.snapshot.activeRequestId) {
      await agentSession.interrupt();
      return;
    }
    const requestId = activeRequestRef.current;
    if (!requestId) {
      return;
    }
    await localAiService.cancel(requestId);
    handleStreamEvent({ type: 'cancelled', requestId });
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const validation = validateMessageInput(input, LOCAL_AI_CONFIG.maxInputLength);
      const tradingIntent = validation.valid ? detectTradingIntent(input) : 'not_trading_intent';
      const journalIntent = validation.valid ? detectJournalIntent(input) : { type: 'none' };
      if (
        agentSession.snapshot.activeRequestId === null &&
        validation.valid &&
        (mode === 'temporary' || storageStatus?.available === true) &&
        (session.selectedModel !== null ||
          tradingIntent !== 'not_trading_intent' ||
          journalIntent.type !== 'none')
      ) {
        void send();
      }
    }
  };

  const confirmPendingMemory = async (memory: Memory) => {
    try {
      await storageService.confirmMemory(memory.id);
      setPendingMemory(null);
      setStorageNotice('Memory saved.');
      void companionService.setState('happy');
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
      setStorageNotice('Memory edited. Confirm it when ready.');
      void companionService.setState('idle');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const rejectPendingMemory = async (memory: Memory) => {
    try {
      await storageService.rejectMemory(memory.id);
      setPendingMemory(null);
      setStorageNotice('Memory dismissed.');
      void companionService.setState('idle');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const inputValidation = validateMessageInput(input, LOCAL_AI_CONFIG.maxInputLength);
  const currentTradingIntent = inputValidation.valid
    ? detectTradingIntent(input)
    : 'not_trading_intent';
  const currentJournalIntent = inputValidation.valid
    ? detectJournalIntent(input)
    : { type: 'none' };
  const canSend =
    agentSession.snapshot.activeRequestId === null &&
    inputValidation.valid &&
    (mode === 'temporary' || storageStatus?.available === true) &&
    (session.selectedModel !== null ||
      currentTradingIntent !== 'not_trading_intent' ||
      currentJournalIntent.type !== 'none');
  const sharedMessages = agentSession.snapshot.messages.map(agentMessageToChatMessage);
  const visibleMessages = (sharedMessages.length > 0 ? sharedMessages : session.messages).slice(-3);
  const latestSharedAssistant = [...agentSession.snapshot.messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const modelLabel = AGENT_PROVIDER_CONFIG.modelLabel;
  const journalActive =
    journalSession.status === 'active' ||
    journalSession.status === 'reviewing' ||
    journalSession.status === 'saving' ||
    journalSession.status === 'error';
  const currentJournalPrompt =
    journalPromptsForKind(journalSession.kind)[journalSession.promptIndex] ?? null;

  const toggleSkinPicker = () => {
    const opening = !showSkinPicker;
    setShowSkinPicker(opening);
    if (!opening || petSkinStatus !== 'idle') {
      return;
    }
    setPetSkinStatus('loading');
    void petdexCatalog()
      .then((skins) => {
        setPetSkins([DEFAULT_PET_SKIN, ...skins]);
        setPetSkinStatus('ready');
      })
      .catch(() => {
        setPetSkinStatus('offline');
      });
  };

  const selectPetSkin = (skin: PetSkinSelection) => {
    setSelectedPetSkin(skin);
    saveSelectedPetSkin(skin);
    void companionService.send({ type: 'set_skin', skin });
    setShowSkinPicker(false);
  };

  return (
    <main className="bubble-view" aria-label="Trading Buddy conversation bubble">
      <section className="bubble-card" aria-live="polite">
        <header className="bubble-card__header">
          <div>
            <strong>Buddy</strong>
            <span>{statusLabel(agentSession.snapshot.connectionStatus)}</span>
          </div>
          <div className="bubble-card__actions">
            <button
              type="button"
              className="text-button"
              aria-label="Choose pet skin"
              aria-expanded={showSkinPicker}
              onClick={toggleSkinPicker}
            >
              Skin
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => void windowService.openMainWindow()}
            >
              Open Home
            </button>
            <button
              type="button"
              className="text-button"
              aria-label="Collapse bubble"
              onClick={() => void windowService.controlBubble('hide')}
            >
              ×
            </button>
          </div>
        </header>

        {showSkinPicker ? (
          <section className="pet-skin-picker" aria-label="Pet skins">
            <div className="pet-skin-picker__list">
              {petSkins.map((skin) => (
                <button
                  type="button"
                  className="pet-skin-option"
                  aria-pressed={selectedPetSkin.id === skin.id}
                  key={skin.id}
                  onClick={() => {
                    selectPetSkin(skin);
                  }}
                >
                  <PetSkinThumbnail skin={skin} />
                  <span>{skin.displayName}</span>
                </button>
              ))}
            </div>
            {petSkinStatus === 'loading' ? <small>Loading Petdex…</small> : null}
            {petSkinStatus === 'offline' ? (
              <small>Petdex is offline. Your Trading Buddy skin remains available.</small>
            ) : null}
            <small>Online skins load from Petdex only when this picker is opened.</small>
          </section>
        ) : null}

        <div className="bubble-messages">
          {visibleMessages.length === 0 ? (
            <p className="bubble-line bubble-line--buddy">I’m here on the desktop. What’s up?</p>
          ) : (
            visibleMessages.map((message) => (
              <p key={message.id} className={`bubble-line bubble-line--${message.role}`}>
                {message.content || (session.status === 'generating' ? 'Thinking…' : '')}
              </p>
            ))
          )}
        </div>

        <SupportModePicker
          compact
          value={agentSession.snapshot.supportMode}
          disabled={agentSession.loading}
          onChange={(supportMode) => {
            void agentSession.setSupportMode(supportMode);
          }}
        />

        <div className="bubble-response-actions">
          {agentSession.snapshot.activeRequestId ? (
            <button type="button" className="text-button" onClick={() => void stop()}>
              Stop
            </button>
          ) : latestSharedAssistant ? (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                void agentSession.retry({
                  requestId: createId('request'),
                  turnId: createId('turn'),
                  model: AGENT_PROVIDER_CONFIG.model,
                  hiddenContext: '',
                })
              }
            >
              Retry
            </button>
          ) : null}
          {latestSharedAssistant?.content ? (
            <button
              type="button"
              className="text-button"
              onClick={() => void navigator.clipboard.writeText(latestSharedAssistant.content)}
            >
              Copy
            </button>
          ) : null}
        </div>

        {pendingMemory ? (
          <MemoryProposalCard
            compact
            memory={pendingMemory}
            onRemember={confirmPendingMemory}
            onEdit={editPendingMemory}
            onReject={rejectPendingMemory}
          />
        ) : null}

        {usedMemories.length > 0 ? (
          <details className="memory-used-indicator memory-used-indicator--compact">
            <summary>Used {String(usedMemories.length)} memories</summary>
            <ul>
              {usedMemories.map((memory) => (
                <li key={memory.id}>{memory.content}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {usedContinuity.length > 0 ? (
          <details className="memory-used-indicator memory-used-indicator--compact">
            <summary>
              Used {String(usedContinuity.length)} continuity items ·{' '}
              {semanticStatus.replaceAll('_', ' ')}
            </summary>
            <ul>
              {usedContinuity.map((item) => (
                <li key={`${item.sourceType}:${item.sourceId}`}>
                  {item.content}
                  <small>Why: {item.reasonCodes.join(', ')}</small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {journalActive ? (
          <JournalSessionCard
            session={journalSession}
            currentPrompt={currentJournalPrompt}
            onBodyChange={(body) => {
              dispatchJournal({ type: 'set_body', body });
            }}
            onAppend={() => {
              dispatchJournal({ type: 'next_prompt' });
            }}
            onNextPrompt={() => {
              dispatchJournal({ type: 'next_prompt' });
            }}
            onSwitchToFreeWrite={() => {
              dispatchJournal({ type: 'set_mode', mode: 'free_write' });
            }}
            onSupportModeChange={(supportMode) => {
              dispatchJournal({ type: 'set_support_mode', supportMode });
              setStorageNotice(supportModeOpening(supportMode));
            }}
            onRatingChange={(field, value) => {
              dispatchJournal({ type: 'set_ratings', [field]: value });
            }}
            onSaveDraft={() => {
              void saveJournalSession('draft');
            }}
            onSaveComplete={() => {
              void saveJournalSession('completed');
            }}
            onDiscard={() => {
              if (
                !sessionHasMeaningfulContent(journalSession) ||
                window.confirm('Discard this unsaved journal session?')
              ) {
                dispatchJournal({ type: 'discard' });
                setStorageNotice('Journal session discarded.');
              }
            }}
          />
        ) : null}

        {storageNotice ? <div className="storage-notice">{storageNotice}</div> : null}

        {storageError ? (
          <div className="bubble-error" role="alert">
            {storageError.userMessage}
          </div>
        ) : null}

        {agentSession.snapshot.connectionStatus === 'offline' ||
        agentSession.snapshot.connectionStatus === 'failed' ? (
          <div className="bubble-error" role="alert">
            Cloud companion is offline.
            <button
              type="button"
              className="text-button"
              onClick={() => void agentSession.retryConnection()}
            >
              Retry
            </button>
          </div>
        ) : null}

        <details className="bubble-tools">
          <summary>Trading tools</summary>
          <TradingBubblePanel
            windowService={windowService}
            localAiOffline={
              agentSession.snapshot.connectionStatus === 'offline' ||
              agentSession.snapshot.connectionStatus === 'failed'
            }
          />
        </details>

        <textarea
          value={input}
          rows={2}
          maxLength={LOCAL_AI_CONFIG.maxInputLength}
          placeholder="Type here…"
          aria-label="Message Buddy"
          onChange={(event) => {
            setInput(event.currentTarget.value);
            setBuddyState(
              event.currentTarget.value.trim()
                ? buddyStateForLifecycle('input_started')
                : buddyStateForLifecycle('input_cleared'),
            );
          }}
          onKeyDown={handleInputKeyDown}
        />

        <footer className="bubble-card__footer">
          <span title={modelLabel}>{modelLabel}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode((value) => (value === 'temporary' ? 'persistent' : 'temporary'));
              setConversationMemoryOptOut(false);
            }}
          >
            {mode === 'temporary' ? 'Temporary on' : 'Saved'}
          </button>
          {session.status === 'generating' ? (
            <button type="button" className="stop-button" onClick={() => void stop()}>
              Stop
            </button>
          ) : (
            <button type="button" onClick={() => void send()} disabled={!canSend}>
              Send
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function PetSkinThumbnail({ skin }: { skin: PetSkinSelection }) {
  if (skin.source === 'local') {
    return <span className="pet-skin-thumbnail pet-skin-thumbnail--local">TB</span>;
  }
  return (
    <span
      className="pet-skin-thumbnail"
      style={
        {
          '--petdex-sheet': `url("${skin.spritesheetUrl ?? ''}")`,
        } as CSSProperties
      }
    />
  );
}

function statusLabel(status: AgentConnectionStatus): string {
  switch (status) {
    case 'stopped':
      return 'cloud companion stopped';
    case 'starting':
    case 'connecting':
      return 'connecting';
    case 'ready':
      return 'DeepSeek ready';
    case 'reconnecting':
      return 'reconnecting';
    case 'offline':
      return 'offline';
    case 'failed':
      return 'needs attention';
  }
}

function isFactIntent(intent: TradingIntent): boolean {
  return (
    intent === 'show_account' ||
    intent === 'show_positions' ||
    intent === 'show_recent_fills' ||
    intent === 'show_funding' ||
    intent === 'show_open_orders'
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Trading facts are unavailable.';
}
