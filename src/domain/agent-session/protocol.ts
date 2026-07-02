import { isAgentSessionError } from './events';
import { isCompanionSupportMode } from './supportMode';
import type {
  AgentConnectionStatus,
  AgentLatencyDiagnostics,
  AgentMessageStatus,
  AgentSessionDiagnostics,
  AgentSessionMessage,
  AgentSessionSnapshot,
  AgentTurnStatus,
} from './types';

export const MAX_AGENT_MESSAGE_LENGTH = 100_000;
export const MAX_AGENT_SNAPSHOT_MESSAGES = 500;

const connectionStatuses = new Set<AgentConnectionStatus>([
  'stopped',
  'starting',
  'connecting',
  'ready',
  'reconnecting',
  'offline',
  'failed',
]);
const turnStatuses = new Set<AgentTurnStatus>([
  'idle',
  'submitting',
  'listening',
  'thinking',
  'streaming',
  'completed',
  'cancelled',
  'failed',
]);
const messageStatuses = new Set<AgentMessageStatus>([
  'pending',
  'streaming',
  'completed',
  'cancelled',
  'failed',
  'superseded',
]);

export function isAgentSessionSnapshot(value: unknown): value is AgentSessionSnapshot {
  return (
    isRecord(value) &&
    isNullableIdentifier(value.localConversationId) &&
    isNullableIdentifier(value.hermesSessionId) &&
    isNullableIdentifier(value.hermesSessionKey) &&
    typeof value.connectionStatus === 'string' &&
    connectionStatuses.has(value.connectionStatus as AgentConnectionStatus) &&
    typeof value.turnStatus === 'string' &&
    turnStatuses.has(value.turnStatus as AgentTurnStatus) &&
    isNullableIdentifier(value.activeRequestId) &&
    isNullableIdentifier(value.activeTurnId) &&
    isCompanionSupportMode(value.supportMode) &&
    typeof value.temporary === 'boolean' &&
    Array.isArray(value.messages) &&
    value.messages.length <= MAX_AGENT_SNAPSHOT_MESSAGES &&
    value.messages.every(isAgentSessionMessage) &&
    Number.isSafeInteger(value.lastSequence) &&
    (value.lastSequence as number) >= 0 &&
    (value.recoverableError === null || isAgentSessionError(value.recoverableError)) &&
    isAgentSessionDiagnostics(value.diagnostics)
  );
}

export function isAgentSessionMessage(value: unknown): value is AgentSessionMessage {
  return (
    isRecord(value) &&
    isIdentifier(value.id) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    value.content.length <= MAX_AGENT_MESSAGE_LENGTH &&
    typeof value.createdAt === 'string' &&
    value.createdAt.length <= 64 &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.status === 'string' &&
    messageStatuses.has(value.status as AgentMessageStatus) &&
    (value.requestId === undefined || isIdentifier(value.requestId)) &&
    (value.sourceUserMessageId === undefined || isIdentifier(value.sourceUserMessageId)) &&
    (value.attempt === undefined ||
      (Number.isSafeInteger(value.attempt) && (value.attempt as number) >= 1))
  );
}

function isAgentSessionDiagnostics(value: unknown): value is AgentSessionDiagnostics {
  return (
    isRecord(value) &&
    isCounter(value.duplicateEventCount) &&
    isCounter(value.staleEventCount) &&
    isCounter(value.reconnectCount) &&
    isAgentLatencyDiagnostics(value.latency)
  );
}

function isAgentLatencyDiagnostics(value: unknown): value is AgentLatencyDiagnostics {
  return (
    isRecord(value) &&
    isNullableCounter(value.clientContextRetrievalMs) &&
    isNullableCounter(value.clientContextBudgetMs) &&
    isNullableCounter(value.clientPromptConstructionMs) &&
    isNullableCounter(value.rustTurnPreparationMs) &&
    isNullableCounter(value.sessionOpenMs) &&
    isNullableCounter(value.promptDispatchMs) &&
    isNullableCounter(value.promptAcceptedAtMs) &&
    isNullableCounter(value.firstProviderEventAtMs) &&
    isNullableCounter(value.providerRequestStartedAtMs) &&
    isNullableCounter(value.firstVisibleContentAtMs) &&
    isNullableCounter(value.completionReceivedAtMs) &&
    isNullableCounter(value.sqliteFinalizationMs) &&
    isNullableCounter(value.crossWindowBroadcastMicros) &&
    isNullableCounter(value.frontendRenderMs) &&
    isNullableCounter(value.totalTurnMs)
  );
}

function isCounter(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNullableCounter(value: unknown): value is number | null {
  return value === null || isCounter(value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
