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
  tauriCompanionService,
  type CompanionService,
} from '../../services/tauri/companionService';
import { tauriLocalAiService, type LocalAiService } from '../../services/tauri/localAiService';
import { tauriWindowService, type WindowService } from '../../services/windowService';
import { BuddyLab } from '../local-ai/BuddyLab';
import { ChatComposer } from './ChatComposer';
import { LocalAiStatusPanel } from './LocalAiStatusPanel';
import { MessageList } from './MessageList';
import { ModelSelector } from './ModelSelector';

interface ChatWorkspaceProps {
  localAiService?: LocalAiService;
  companionService?: CompanionService;
  windowService?: WindowService;
}

export function ChatWorkspace({
  localAiService = tauriLocalAiService,
  companionService = tauriCompanionService,
  windowService = tauriWindowService,
}: ChatWorkspaceProps) {
  const [session, dispatch] = useReducer(conversationReducer, undefined, () =>
    createConversationSession(),
  );
  const [providerStatus, setProviderStatus] = useState<LocalAiStatus>({ status: 'checking' });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [buddyState, setBuddyStateValue] = useState<BuddyState>('idle');
  const activeRequestRef = useRef<string | null>(null);
  const selectedModelRef = useRef<string | null>(null);
  const requestKindRef = useRef<'real' | 'mock' | null>(null);
  const mockRunRef = useRef<{ requestId: string; cancelled: boolean } | null>(null);
  const errorTimerRef = useRef<number | null>(null);

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
  }, [localAiService, setBuddyState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshModels();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshModels]);

  useEffect(
    () => () => {
      if (activeRequestRef.current && requestKindRef.current === 'real') {
        void localAiService.cancel(activeRequestRef.current);
      }
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
    },
    [localAiService],
  );

  const handleStreamEvent = useCallback(
    (event: LocalChatEvent) => {
      dispatch({ type: 'stream_event', event });
      if (event.requestId !== activeRequestRef.current) {
        return;
      }
      if (event.type === 'content_delta') {
        setBuddyState(buddyStateForLifecycle('response_started'));
      } else if (event.type === 'completed') {
        requestKindRef.current = null;
        setBuddyState(buddyStateForLifecycle('generation_completed'));
      } else if (event.type === 'cancelled') {
        requestKindRef.current = null;
        setBuddyState(buddyStateForLifecycle('generation_cancelled'));
      } else if (event.type === 'failed') {
        requestKindRef.current = null;
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
    [providerStatus.status, setBuddyState],
  );

  const startGeneration = useCallback(
    async (content: string, mode: 'real' | 'mock') => {
      if (activeRequestRef.current || (mode === 'real' && !session.selectedModel)) {
        return;
      }
      const requestId = createId('request');
      const userMessage = createChatMessage('user', content);
      const assistantMessage = createChatMessage('assistant', '');
      const request: LocalChatRequest = {
        requestId,
        conversationId: session.id,
        model: session.selectedModel ?? LOCAL_AI_CONFIG.recommendedModel,
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
      requestKindRef.current = mode;
      mockRunRef.current = mode === 'mock' ? { requestId, cancelled: false } : null;
      dispatch({ type: 'start_generation', requestId, userMessage, assistantMessage });
      setInput('');
      setBuddyState(buddyStateForLifecycle('message_submitted'));

      if (mode === 'mock') {
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
      handleStreamEvent,
      localAiService,
      session.id,
      session.messages,
      session.selectedModel,
      setBuddyState,
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

  const clear = () => {
    if (session.messages.length === 0 || window.confirm('Clear this in-memory conversation?')) {
      void stop().finally(() => {
        dispatch({ type: 'clear_session' });
      });
    }
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

  const models = providerStatus.status === 'connected' ? providerStatus.models : [];
  const canSend = canSubmitMessage(session, input, LOCAL_AI_CONFIG.maxInputLength);

  return (
    <div className="chat-workspace">
      <LocalAiStatusPanel status={providerStatus} onRetry={() => void refreshModels()} />
      {providerStatus.status === 'connected' ? (
        <ModelSelector
          models={models}
          selectedModel={session.selectedModel}
          thinking={thinking}
          disabled={session.status === 'generating'}
          onSelect={(model) => {
            dispatch({ type: 'select_model', model });
          }}
          onThinkingChange={setThinking}
        />
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

      <p className="persistence-note">
        Conversation persistence will be added in the next storage milestone.
      </p>

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
