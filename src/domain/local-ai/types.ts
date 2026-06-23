export interface LocalModel {
  name: string;
  modifiedAt?: string;
  sizeBytes?: number;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

export type LocalAiStatus =
  | { status: 'checking' }
  | { status: 'connected'; models: LocalModel[] }
  | { status: 'ollama_not_running' }
  | { status: 'no_models' }
  | { status: 'error'; error: LocalAiError };

export type LocalAiErrorCode =
  | 'ollama_not_running'
  | 'no_models_installed'
  | 'selected_model_unavailable'
  | 'connection_timeout'
  | 'request_cancelled'
  | 'malformed_ollama_response'
  | 'generation_failed'
  | 'invalid_frontend_request'
  | 'internal_application_error';

export interface LocalAiError {
  code: LocalAiErrorCode;
  userMessage: string;
  technicalMessage?: string;
  retryable: boolean;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface LocalChatRequest {
  requestId: string;
  conversationId: string;
  model: string;
  messages: {
    role: ChatRole;
    content: string;
  }[];
  think?: boolean;
}

export interface GenerationMetrics {
  totalDurationNs?: number;
  loadDurationNs?: number;
  promptEvalCount?: number;
  promptEvalDurationNs?: number;
  evalCount?: number;
  evalDurationNs?: number;
}

export type LocalChatEvent =
  | { type: 'started'; requestId: string }
  | { type: 'content_delta'; requestId: string; content: string }
  | { type: 'thinking_delta'; requestId: string; content: string }
  | { type: 'completed'; requestId: string; metrics?: GenerationMetrics }
  | { type: 'failed'; requestId: string; error: LocalAiError }
  | { type: 'cancelled'; requestId: string };

const errorCodes: ReadonlySet<string> = new Set<LocalAiErrorCode>([
  'ollama_not_running',
  'no_models_installed',
  'selected_model_unavailable',
  'connection_timeout',
  'request_cancelled',
  'malformed_ollama_response',
  'generation_failed',
  'invalid_frontend_request',
  'internal_application_error',
]);

export function isLocalModel(value: unknown): value is LocalModel {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return false;
  }
  return (
    isOptionalString(value.modifiedAt) &&
    isOptionalNumber(value.sizeBytes) &&
    isOptionalString(value.family) &&
    isOptionalString(value.parameterSize) &&
    isOptionalString(value.quantizationLevel)
  );
}

export function isLocalModelList(value: unknown): value is LocalModel[] {
  return Array.isArray(value) && value.every(isLocalModel);
}

export function isLocalAiError(value: unknown): value is LocalAiError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    errorCodes.has(value.code) &&
    typeof value.userMessage === 'string' &&
    isOptionalString(value.technicalMessage) &&
    typeof value.retryable === 'boolean'
  );
}

export function isLocalChatEvent(value: unknown): value is LocalChatEvent {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.requestId !== 'string') {
    return false;
  }
  switch (value.type) {
    case 'started':
    case 'cancelled':
      return true;
    case 'content_delta':
    case 'thinking_delta':
      return typeof value.content === 'string';
    case 'completed':
      return value.metrics === undefined || isGenerationMetrics(value.metrics);
    case 'failed':
      return isLocalAiError(value.error);
    default:
      return false;
  }
}

export function normalizeLocalAiError(value: unknown): LocalAiError {
  if (value instanceof LocalAiException) {
    return value.detail;
  }
  if (isLocalAiError(value)) {
    return value;
  }
  return {
    code: 'internal_application_error',
    userMessage: 'Trading Buddy could not communicate with the local AI service.',
    technicalMessage: value instanceof Error ? value.message : String(value),
    retryable: true,
  };
}

export class LocalAiException extends Error {
  constructor(public readonly detail: LocalAiError) {
    super(detail.userMessage);
    this.name = 'LocalAiException';
  }
}

function isGenerationMetrics(value: unknown): value is GenerationMetrics {
  if (!isRecord(value)) {
    return false;
  }
  return [
    value.totalDurationNs,
    value.loadDurationNs,
    value.promptEvalCount,
    value.promptEvalDurationNs,
    value.evalCount,
    value.evalDurationNs,
  ].every(isOptionalNumber);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}
