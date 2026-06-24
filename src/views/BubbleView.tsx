import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { buddyStateForLifecycle } from '../domain/companion/buddyState';
import {
  canSubmitMessage,
  conversationReducer,
  createChatMessage,
  createConversationSession,
  createId,
  validateMessageInput,
} from '../domain/conversation/session';
import { LOCAL_AI_CONFIG } from '../domain/local-ai/config';
import { selectPreferredModel } from '../domain/local-ai/modelSelection';
import { COMPANION_SYSTEM_PROMPT } from '../domain/local-ai/systemPrompt';
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
import { tauriCompanionService, type CompanionService } from '../services/tauri/companionService';
import { tauriLocalAiService, type LocalAiService } from '../services/tauri/localAiService';
import { tauriStorageService, type StorageService } from '../services/tauri/storageService';
import { tauriWindowService, type WindowService } from '../services/windowService';

type PersistenceMode = 'persistent' | 'temporary';

interface BubbleViewProps {
  localAiService?: LocalAiService;
  storageService?: StorageService;
  companionService?: CompanionService;
  windowService?: WindowService;
}

interface ActiveAssistantPersistence {
  mode: PersistenceMode;
  messageId: string;
  requestId: string;
  content: string;
}

export function BubbleView({
  localAiService = tauriLocalAiService,
  storageService = tauriStorageService,
  companionService = tauriCompanionService,
  windowService = tauriWindowService,
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

  const send = async () => {
    const validation = validateMessageInput(input, LOCAL_AI_CONFIG.maxInputLength);
    if (!validation.valid || !session.selectedModel || session.activeRequestId) {
      return;
    }
    const requestId = createId('request');
    const selectedModel = session.selectedModel;
    let conversationId = session.id;
    let userMessage = createChatMessage('user', validation.content);
    let assistantMessage = createChatMessage('assistant', '');

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
          messageId: prepared.assistantMessage.id,
          requestId,
          content: '',
        };
      } catch (error) {
        setStorageError(normalizeStorageError(error));
        return;
      }
    } else {
      persistenceRef.current = {
        mode: 'temporary',
        messageId: assistantMessage.id,
        requestId,
        content: '',
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
    setBuddyState(buddyStateForLifecycle('message_submitted'));

    try {
      await localAiService.streamChat(request, handleStreamEvent);
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
      if (canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength)) {
        void send();
      }
    }
  };

  const canSend =
    canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength) &&
    (mode === 'temporary' || storageStatus?.available === true);
  const visibleMessages = session.messages.slice(-4);
  const modelLabel = session.selectedModel ?? 'No model selected';

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
