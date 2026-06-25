import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { buddyStateForLifecycle } from '../domain/companion/buddyState';
import {
  conversationReducer,
  createChatMessage,
  createConversationSession,
  createId,
  validateMessageInput,
} from '../domain/conversation/session';
import { LOCAL_AI_CONFIG } from '../domain/local-ai/config';
import { selectPreferredModel } from '../domain/local-ai/modelSelection';
import { COMPANION_SYSTEM_PROMPT } from '../domain/local-ai/systemPrompt';
import { buildTradingContext } from '../domain/trading/context';
import { readOnlyExecutionRefusal } from '../domain/trading/formatting';
import { detectTradingIntent, type TradingIntent } from '../domain/trading/intents';
import {
  normalizeLocalAiError,
  type LocalAiStatus,
  type LocalChatEvent,
  type LocalChatRequest,
} from '../domain/local-ai/types';
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
}

interface ActiveAssistantPersistence {
  mode: PersistenceMode;
  conversationId: string;
  messageId: string;
  requestId: string;
  content: string;
  memoryIds: string[];
}

export function BubbleView({
  localAiService = tauriLocalAiService,
  storageService = tauriStorageService,
  companionService = tauriCompanionService,
  windowService = tauriWindowService,
  tradingService = tauriTradingService,
}: BubbleViewProps) {
  const [session, dispatch] = useReducer(conversationReducer, undefined, () =>
    createConversationSession(),
  );
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<PersistenceMode>('persistent');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<LocalAiStatus>({ status: 'checking' });
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [pendingMemory, setPendingMemory] = useState<Memory | null>(null);
  const [usedMemories, setUsedMemories] = useState<RetrievedMemory[]>([]);
  const [conversationMemoryOptOut, setConversationMemoryOptOut] = useState(false);
  const [journalSession, setJournalSession] = useState(createIdleJournalSession);
  const activeRequestRef = useRef<string | null>(null);
  const selectedModelRef = useRef<string | null>(null);
  const persistenceRef = useRef<ActiveAssistantPersistence | null>(null);

  useEffect(() => {
    activeRequestRef.current = session.activeRequestId;
    selectedModelRef.current = session.selectedModel;
  }, [session.activeRequestId, session.selectedModel]);

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
      selectedModelRef.current = selectedModel;
      dispatch({ type: 'provider_ready', selectedModel });
      setBuddyState('idle');
    } catch (error) {
      const normalized = normalizeLocalAiError(error);
      setProviderStatus(
        normalized.code === 'ollama_not_running'
          ? { status: 'ollama_not_running' }
          : { status: 'error', error: normalized },
      );
      dispatch({ type: 'provider_failed', error: normalized });
      setBuddyState(buddyStateForLifecycle('provider_unavailable'));
    }
  }, [localAiService, setBuddyState]);

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
        if (settings.selectedLocalModel) {
          selectedModelRef.current = settings.selectedLocalModel;
          dispatch({ type: 'select_model', model: settings.selectedLocalModel });
        }
        const lastConversationId = settings.lastOpenedConversationId;
        if (lastConversationId) {
          const detail = await storageService.getConversation(lastConversationId);
          setActiveConversationId(lastConversationId);
          dispatch({
            type: 'load_session',
            conversationId: lastConversationId,
            messages: detail.messages.map(storedMessageToChatMessage),
          });
        }
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    })();
    const timer = window.setTimeout(() => {
      void refreshModels();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshModels, storageService]);

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
    [storageService],
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
    if (!validation.valid || session.activeRequestId) {
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
      const accountId = loadActiveTradingAccountId();
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
        const accountId = loadActiveTradingAccountId();
        appendDeterministicReply(
          validation.content,
          accountId
            ? 'Local AI is offline, but your saved account fact cards are still available below.'
            : 'Local AI is offline, and no Hyperliquid account is selected. Open Trading to connect or select an account.',
        );
      }
      return;
    }
    const requestId = createId('request');
    const selectedModel = session.selectedModel;
    let conversationId = session.id;
    let userMessage = createChatMessage('user', validation.content);
    let assistantMessage = createChatMessage('assistant', '');
    let memoryContext: string | null = null;
    let tradingContext: string | null = null;
    let memoryOptedOutForRequest = conversationMemoryOptOut;
    let memoryNotice: string | null = null;

    if (mode === 'persistent') {
      try {
        const prepared = await storageService.prepareGeneration({
          requestId,
          userContent: validation.content,
          modelName: selectedModel,
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        });
        conversationId = prepared.conversation.id;
        userMessage = storedMessageToChatMessage(prepared.userMessage);
        assistantMessage = storedMessageToChatMessage(prepared.assistantMessage);
        setActiveConversationId(conversationId);
        persistenceRef.current = {
          mode: 'persistent',
          conversationId,
          messageId: prepared.assistantMessage.id,
          requestId,
          content: '',
          memoryIds: [],
        };
      } catch (error) {
        setStorageError(normalizeStorageError(error));
        return;
      }
    } else {
      persistenceRef.current = {
        mode: 'temporary',
        conversationId,
        messageId: assistantMessage.id,
        requestId,
        content: '',
        memoryIds: [],
      };
    }

    if (isFactIntent(tradingIntent)) {
      const accountId = loadActiveTradingAccountId();
      if (!accountId) {
        appendDeterministicReply(
          validation.content,
          'No Hyperliquid account is selected. Open Trading to connect or select an account.',
        );
        return;
      }
      try {
        const facts = await fetchTradingFacts(tradingService, accountId, tradingIntent);
        tradingContext = buildTradingContext(
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

    if (!isFactIntent(tradingIntent)) {
      try {
        const memoryContextResult = await buildMemoryContextForMessage({
          storageService,
          content: validation.content,
          temporaryChat: mode === 'temporary',
        });
        memoryContext = memoryContextResult.context;
        setUsedMemories(memoryContextResult.retrieved);
        if (persistenceRef.current.requestId === requestId) {
          persistenceRef.current.memoryIds = memoryContextResult.retrieved.map(
            (memory) => memory.id,
          );
        }
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
          sourceMessageId: mode === 'persistent' ? userMessage.id : undefined,
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

    const request: LocalChatRequest = {
      requestId,
      conversationId,
      model: selectedModel,
      messages: [
        { role: 'system', content: COMPANION_SYSTEM_PROMPT },
        ...(tradingContext
          ? [
              { role: 'system' as const, content: READ_ONLY_TRADING_RULES },
              { role: 'system' as const, content: tradingContext },
            ]
          : []),
        ...(memoryContext ? [{ role: 'system' as const, content: memoryContext }] : []),
        ...session.messages
          .filter((message) => message.content)
          .map(({ role, content }) => ({ role, content })),
        { role: 'user', content: validation.content },
      ],
    };

    activeRequestRef.current = requestId;
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

    try {
      await localAiService.streamChat(request, handleStreamEvent);
      if (!isFactIntent(tradingIntent)) {
        const settings = await storageService.getSettings();
        void runBackgroundMemoryExtraction({
          storageService,
          localAiService,
          content: validation.content,
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
              void companionService.setState('thinking');
            }
          })
          .catch((error: unknown) => {
            setStorageError(normalizeStorageError(error));
          });
      }
    } catch (error) {
      handleStreamEvent({
        type: 'failed',
        requestId,
        error: normalizeLocalAiError(error),
      });
    }
  };

  const stop = async () => {
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
        session.activeRequestId === null &&
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
    session.activeRequestId === null &&
    inputValidation.valid &&
    (mode === 'temporary' || storageStatus?.available === true) &&
    (session.selectedModel !== null ||
      currentTradingIntent !== 'not_trading_intent' ||
      currentJournalIntent.type !== 'none');
  const visibleMessages = session.messages.slice(-4);
  const modelLabel = session.selectedModel ?? 'No model selected';
  const journalActive =
    journalSession.status === 'active' ||
    journalSession.status === 'reviewing' ||
    journalSession.status === 'saving' ||
    journalSession.status === 'error';
  const currentJournalPrompt =
    journalPromptsForKind(journalSession.kind)[journalSession.promptIndex] ?? null;

  return (
    <main className="bubble-view" aria-label="Trading Buddy conversation bubble">
      <section className="bubble-card" aria-live="polite">
        <header className="bubble-card__header">
          <div>
            <strong>Buddy</strong>
            <span>{statusLabel(providerStatus)}</span>
          </div>
          <div className="bubble-card__actions">
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

        {providerStatus.status === 'ollama_not_running' || providerStatus.status === 'error' ? (
          <div className="bubble-error" role="alert">
            Local AI is offline.
            <button type="button" className="text-button" onClick={() => void refreshModels()}>
              Retry
            </button>
          </div>
        ) : null}

        <TradingBubblePanel
          windowService={windowService}
          localAiOffline={
            providerStatus.status === 'ollama_not_running' || providerStatus.status === 'error'
          }
        />

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

function statusLabel(status: LocalAiStatus): string {
  switch (status.status) {
    case 'checking':
      return 'checking local AI';
    case 'connected':
      return 'local AI ready';
    case 'ollama_not_running':
      return 'offline';
    case 'no_models':
      return 'no model';
    case 'error':
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
