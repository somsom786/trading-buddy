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
  type StorageError,
  type StorageStatus,
} from '../../domain/storage/types';
import {
  tauriCompanionService,
  type CompanionService,
} from '../../services/tauri/companionService';
import { tauriLocalAiService, type LocalAiService } from '../../services/tauri/localAiService';
import { tauriStorageService, type StorageService } from '../../services/tauri/storageService';
import { tauriWindowService, type WindowService } from '../../services/windowService';
import { BuddyLab } from '../local-ai/BuddyLab';
import { ChatComposer } from './ChatComposer';
import { LocalAiStatusPanel } from './LocalAiStatusPanel';
import { MessageList } from './MessageList';
import { ModelSelector } from './ModelSelector';

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
  messageId: string;
  requestId: string;
  content: string;
  lastSavedLength: number;
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

  const refreshConversationLists = useCallback(async () => {
    const [active, archived] = await Promise.all([
      storageService.listConversations({ archived: false, limit: 50 }),
      storageService.listConversations({ archived: true, limit: 50 }),
    ]);
    setConversations(active);
    setArchivedConversations(archived);
    return { active, archived };
  }, [storageService]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (activeRequestRef.current) {
        setStorageNotice('Stop the current generation before switching conversations.');
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
        setStorageError(null);
        setStorageNotice(null);
        await storageService.setLastOpenedConversation(conversationId);
      } catch (error) {
        setStorageError(normalizeStorageError(error));
      }
    },
    [storageService],
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
            messageId: prepared.assistantMessage.id,
            requestId,
            content: '',
            lastSavedLength: 0,
          };
          await refreshConversationLists();
        } catch (error) {
          setStorageError(normalizeStorageError(error));
          return;
        }
      } else {
        assistantPersistenceRef.current = {
          mode: 'temporary',
          messageId: assistantMessage.id,
          requestId,
          content: '',
          lastSavedLength: 0,
        };
      }

      const request: LocalChatRequest = {
        requestId,
        conversationId,
        model: selectedModel,
        messages: [
          { role: 'system', content: COMPANION_SYSTEM_PROMPT },
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
      setStorageNotice(null);
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
    setMode('persistent');
    setActiveConversationId(null);
    dispatch({ type: 'clear_session' });
    setStorageNotice('New chat is ready. It will be saved after your first message.');
  };

  const startTemporaryChat = () => {
    if (activeRequestRef.current) {
      setStorageNotice('Stop the current generation before switching to temporary chat.');
      return;
    }
    setMode('temporary');
    setActiveConversationId(null);
    dispatch({ type: 'clear_session' });
    setStorageNotice('Temporary chat is on. Conversation content will not be written to disk.');
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
    if (!title) {
      return;
    }
    try {
      await storageService.renameConversation(activeConversationId, title);
      await refreshConversationLists();
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const archiveActiveConversation = async () => {
    if (!activeConversationId || !window.confirm('Archive this conversation?')) {
      return;
    }
    try {
      await stop();
      await storageService.archiveConversation(activeConversationId);
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      await refreshConversationLists();
      setStorageNotice('Conversation archived.');
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const deleteActiveConversation = async () => {
    if (!activeConversationId || !window.confirm('Permanently delete this conversation?')) {
      return;
    }
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
    }
  };

  const restoreConversation = async (conversationId: string) => {
    try {
      await storageService.restoreConversation(conversationId);
      await refreshConversationLists();
      setShowArchived(false);
      await loadConversation(conversationId);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
    }
  };

  const clearAllData = async () => {
    const confirmation = window.prompt(
      'Type DELETE to permanently delete all saved conversations.',
      '',
    );
    if (confirmation !== 'DELETE') {
      return;
    }
    try {
      await stop();
      const result = await storageService.deleteAllConversationData();
      setActiveConversationId(null);
      dispatch({ type: 'clear_session' });
      await refreshConversationLists();
      setStorageNotice(`Deleted ${String(result.deletedConversations)} saved conversation(s).`);
    } catch (error) {
      setStorageError(normalizeStorageError(error));
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

  const exportConversations = async () => {
    try {
      const result = await storageService.exportConversations();
      if (result) {
        setLastExport(result);
        setStorageNotice(`Exported ${String(result.exportedConversations)} conversation(s).`);
      }
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

  return (
    <div className="chat-shell">
      <aside className="conversation-sidebar" aria-label="Conversations">
        <div className="conversation-sidebar__actions">
          <button type="button" onClick={startNewPersistentChat}>
            New chat
          </button>
          <button type="button" className="secondary-button" onClick={startTemporaryChat}>
            Temporary chat
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
        <div className="conversation-list">
          {loadingStorage ? <p className="muted">Loading conversations…</p> : null}
          {(showArchived ? archivedConversations : conversations).length === 0 &&
          !loadingStorage ? (
            <p className="muted">
              {showArchived ? 'No archived conversations.' : 'No saved chats yet.'}
            </p>
          ) : null}
          {(showArchived ? archivedConversations : conversations).map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`conversation-list__item${
                conversation.id === activeConversationId ? ' conversation-list__item--active' : ''
              }`}
              onClick={() =>
                showArchived
                  ? void restoreConversation(conversation.id)
                  : void loadConversation(conversation.id)
              }
            >
              <strong>{conversation.title}</strong>
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
          </div>
          {mode === 'persistent' ? (
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void renameActiveConversation()}
                disabled={!activeConversationId}
              >
                Rename
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void archiveActiveConversation()}
                disabled={!activeConversationId}
              >
                Archive
              </button>
              <button
                type="button"
                className="stop-button"
                onClick={() => void deleteActiveConversation()}
                disabled={!activeConversationId}
              >
                Delete
              </button>
            </div>
          ) : (
            <span className="temporary-pill">Not saved</span>
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
            {import.meta.env.DEV && storageError.technicalMessage ? (
              <details>
                <summary>Technical details</summary>
                <pre>{storageError.technicalMessage}</pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {storageNotice ? <div className="storage-notice">{storageNotice}</div> : null}

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
          <dl>
            <dt>Database location</dt>
            <dd>{storageStatus?.databasePath ?? 'Unavailable'}</dd>
            <dt>Retention</dt>
            <dd>
              <select
                value={retentionPolicy}
                onChange={(event) =>
                  void updateRetentionPolicy(event.currentTarget.value as RetentionPolicy)
                }
              >
                <option value="keep_until_delete">Keep until I delete</option>
                <option value="delete_after_30_days">Delete after 30 days</option>
                <option value="delete_after_90_days">Delete after 90 days</option>
              </select>
            </dd>
          </dl>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void exportConversations()}
            >
              Export conversations
            </button>
            <button type="button" className="stop-button" onClick={() => void clearAllData()}>
              Delete all conversation data
            </button>
          </div>
          {lastExport ? <p className="muted">Last export: {lastExport.filePath}</p> : null}
          <p className="muted">
            Deletion reduces recoverability with SQLite secure delete, WAL checkpointing, and
            vacuuming, but SSD behavior, OS caches, backups, and filesystem snapshots may still
            retain historical data.
          </p>
        </details>

        {import.meta.env.DEV ? (
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
                dispatch({ type: 'start_generation', requestId, userMessage, assistantMessage });
              }
              handleStreamEvent({
                type: 'failed',
                requestId,
                error: simulatedError(),
              });
            }}
            onMockCancel={() => void stop()}
          />
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
