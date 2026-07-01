import type { AgentSessionError } from './types';

export type AgentStreamEventType =
  | 'accepted'
  | 'listening'
  | 'thinking'
  | 'content_delta'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'connection_lost'
  | 'connection_restored';

export interface AgentStreamEvent {
  sessionId: string;
  requestId: string;
  turnId: string;
  sequence: number;
  type: AgentStreamEventType;
  content?: string;
  error?: AgentSessionError;
}

export const MAX_AGENT_EVENT_CONTENT_LENGTH = 32_768;

const eventTypes = new Set<AgentStreamEventType>([
  'accepted',
  'listening',
  'thinking',
  'content_delta',
  'completed',
  'cancelled',
  'failed',
  'connection_lost',
  'connection_restored',
]);

export function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  if (
    !isRecord(value) ||
    !isIdentifier(value.sessionId) ||
    !isIdentifier(value.requestId) ||
    !isIdentifier(value.turnId) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) <= 0 ||
    typeof value.type !== 'string' ||
    !eventTypes.has(value.type as AgentStreamEventType)
  ) {
    return false;
  }
  if (
    value.content !== undefined &&
    (typeof value.content !== 'string' ||
      value.content.length > MAX_AGENT_EVENT_CONTENT_LENGTH ||
      value.type !== 'content_delta')
  ) {
    return false;
  }
  if (value.type === 'content_delta' && typeof value.content !== 'string') {
    return false;
  }
  if (value.error !== undefined && !isAgentSessionError(value.error)) {
    return false;
  }
  return value.type !== 'failed' || isAgentSessionError(value.error);
}

export function isAgentSessionError(value: unknown): value is AgentSessionError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    [
      'backend_unavailable',
      'provider_unavailable',
      'session_not_found',
      'request_interrupted',
      'request_timeout',
      'invalid_response',
      'internal_error',
    ].includes(value.code) &&
    typeof value.userMessage === 'string' &&
    value.userMessage.length > 0 &&
    value.userMessage.length <= 1_000 &&
    typeof value.retryable === 'boolean'
  );
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
