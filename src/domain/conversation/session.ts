import type {
  ChatMessage,
  GenerationMetrics,
  LocalAiError,
  LocalChatEvent,
} from '../local-ai/types';

export interface ConversationSession {
  id: string;
  messages: ChatMessage[];
  activeRequestId: string | null;
  selectedModel: string | null;
  status: 'idle' | 'checking_provider' | 'ready' | 'generating' | 'error';
  error: LocalAiError | null;
  thinkingReceived: boolean;
  metrics: GenerationMetrics | null;
}

export type ConversationAction =
  | { type: 'provider_checking' }
  | { type: 'provider_ready'; selectedModel: string }
  | { type: 'provider_failed'; error: LocalAiError }
  | { type: 'select_model'; model: string | null }
  | {
      type: 'start_generation';
      conversationId?: string;
      requestId: string;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
    }
  | { type: 'stream_event'; event: LocalChatEvent }
  | { type: 'load_session'; conversationId: string; messages: ChatMessage[] }
  | { type: 'clear_session' };

export function createConversationSession(id = createId('conversation')): ConversationSession {
  return {
    id,
    messages: [],
    activeRequestId: null,
    selectedModel: null,
    status: 'checking_provider',
    error: null,
    thinkingReceived: false,
    metrics: null,
  };
}

export function conversationReducer(
  session: ConversationSession,
  action: ConversationAction,
): ConversationSession {
  switch (action.type) {
    case 'provider_checking':
      return { ...session, status: 'checking_provider', error: null };
    case 'provider_ready':
      return {
        ...session,
        status: session.activeRequestId ? 'generating' : 'ready',
        selectedModel: action.selectedModel,
        error: null,
      };
    case 'provider_failed':
      return {
        ...session,
        status: 'error',
        activeRequestId: null,
        error: action.error,
      };
    case 'select_model':
      return { ...session, selectedModel: action.model };
    case 'start_generation':
      if (session.activeRequestId) {
        return session;
      }
      return {
        ...session,
        id: action.conversationId ?? session.id,
        messages: [...session.messages, action.userMessage, action.assistantMessage],
        activeRequestId: action.requestId,
        status: 'generating',
        error: null,
        thinkingReceived: false,
        metrics: null,
      };
    case 'stream_event':
      return reduceStreamEvent(session, action.event);
    case 'load_session':
      return {
        ...session,
        id: action.conversationId,
        messages: action.messages,
        activeRequestId: null,
        status: session.selectedModel ? 'ready' : 'idle',
        error: null,
        thinkingReceived: false,
        metrics: null,
      };
    case 'clear_session':
      return {
        ...createConversationSession(createId('conversation')),
        selectedModel: session.selectedModel,
        status: session.selectedModel ? 'ready' : 'idle',
      };
  }
}

export function validateMessageInput(
  input: string,
  maxLength: number,
): { valid: true; content: string } | { valid: false; reason: 'blank' | 'too_long' } {
  const content = input.trim();
  if (!content) {
    return { valid: false, reason: 'blank' };
  }
  if (content.length > maxLength) {
    return { valid: false, reason: 'too_long' };
  }
  return { valid: true, content };
}

export function canSubmitMessage(
  session: ConversationSession,
  input: string,
  maxLength: number,
): boolean {
  return (
    session.status !== 'generating' &&
    session.activeRequestId === null &&
    session.selectedModel !== null &&
    validateMessageInput(input, maxLength).valid
  );
}

export function createChatMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: createId(role),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${String(Date.now())}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function reduceStreamEvent(
  session: ConversationSession,
  event: LocalChatEvent,
): ConversationSession {
  if (event.requestId !== session.activeRequestId) {
    return session;
  }
  switch (event.type) {
    case 'started':
      return session;
    case 'content_delta':
      return {
        ...session,
        messages: session.messages.map((message, index) =>
          index === session.messages.length - 1 && message.role === 'assistant'
            ? { ...message, content: message.content + event.content }
            : message,
        ),
      };
    case 'thinking_delta':
      return { ...session, thinkingReceived: true };
    case 'completed':
      return {
        ...session,
        activeRequestId: null,
        status: session.selectedModel ? 'ready' : 'idle',
        metrics: event.metrics ?? null,
      };
    case 'failed':
      return {
        ...session,
        activeRequestId: null,
        status: 'error',
        error: event.error,
      };
    case 'cancelled':
      return {
        ...session,
        activeRequestId: null,
        status: session.selectedModel ? 'ready' : 'idle',
      };
  }
}
