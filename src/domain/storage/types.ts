import type { ChatMessage } from '../local-ai/types';

export type StorageErrorCode =
  | 'database_unavailable'
  | 'migration_failed'
  | 'invalid_stored_data'
  | 'conversation_not_found'
  | 'message_not_found'
  | 'write_failed'
  | 'read_failed'
  | 'export_failed'
  | 'deletion_failed'
  | 'retention_cleanup_failed'
  | 'invalid_frontend_request';

export interface StorageError {
  code: StorageErrorCode;
  userMessage: string;
  technicalMessage?: string;
  retryable: boolean;
}

export interface StorageStatus {
  available: boolean;
  databasePath?: string;
  schemaVersion?: number;
  error?: StorageError;
}

export type RetentionPolicy = 'keep_until_delete' | 'delete_after_30_days' | 'delete_after_90_days';

export interface AppSettings {
  selectedLocalModel?: string;
  ambientAnimationsEnabled: boolean;
  conversationRetentionPolicy: RetentionPolicy;
  lastOpenedConversationId?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  messageCount: number;
}

export type StoredMessageStatus =
  | 'completed'
  | 'streaming'
  | 'cancelled'
  | 'failed'
  | 'interrupted';

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: StoredMessageStatus;
  modelName?: string;
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorCode?: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: StoredMessage[];
}

export interface PrepareGenerationRequest {
  conversationId?: string;
  requestId: string;
  userContent: string;
  modelName: string;
}

export interface PrepareGenerationResponse {
  conversation: ConversationSummary;
  userMessage: StoredMessage;
  assistantMessage: StoredMessage;
}

export interface AssistantMessageUpdate {
  messageId: string;
  requestId: string;
  content: string;
}

export interface AssistantMessageFailure extends AssistantMessageUpdate {
  errorCode: string;
}

export interface RetentionCleanupResult {
  removedConversations: number;
}

export interface DeleteAllResult {
  deletedConversations: number;
}

export interface ExportResult {
  exportedConversations: number;
  filePath: string;
}

export function storedMessageToChatMessage(message: StoredMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: decorateStoredMessageContent(message),
    createdAt: message.createdAt,
  };
}

export function decorateStoredMessageContent(message: StoredMessage): string {
  if (message.role !== 'assistant') {
    return message.content;
  }
  if (message.status === 'cancelled') {
    return message.content ? `${message.content}\n\n[Cancelled]` : '[Cancelled]';
  }
  if (message.status === 'failed') {
    return message.content ? `${message.content}\n\n[Failed]` : '[Failed]';
  }
  if (message.status === 'interrupted') {
    return message.content ? `${message.content}\n\n[Interrupted]` : '[Interrupted]';
  }
  return message.content;
}

export function normalizeStorageError(value: unknown): StorageError {
  if (value instanceof StorageException) {
    return value.detail;
  }
  if (isStorageError(value)) {
    return value;
  }
  return {
    code: 'database_unavailable',
    userMessage: 'Trading Buddy could not communicate with local storage.',
    technicalMessage: value instanceof Error ? value.message : String(value),
    retryable: true,
  };
}

export class StorageException extends Error {
  constructor(public readonly detail: StorageError) {
    super(detail.userMessage);
    this.name = 'StorageException';
  }
}

export function isStorageError(value: unknown): value is StorageError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    storageErrorCodes.has(value.code as StorageErrorCode) &&
    typeof value.userMessage === 'string' &&
    (value.technicalMessage === undefined || typeof value.technicalMessage === 'string') &&
    typeof value.retryable === 'boolean'
  );
}

export function isConversationSummary(value: unknown): value is ConversationSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    optionalString(value.archivedAt) &&
    optionalString(value.lastMessageAt) &&
    optionalString(value.lastMessagePreview) &&
    typeof value.messageCount === 'number'
  );
}

export function isConversationDetail(value: unknown): value is ConversationDetail {
  return (
    isRecord(value) &&
    isConversationSummary(value.conversation) &&
    Array.isArray(value.messages) &&
    value.messages.every(isStoredMessage)
  );
}

export function isAppSettings(value: unknown): value is AppSettings {
  return (
    isRecord(value) &&
    optionalString(value.selectedLocalModel) &&
    typeof value.ambientAnimationsEnabled === 'boolean' &&
    retentionPolicies.has(value.conversationRetentionPolicy as RetentionPolicy) &&
    optionalString(value.lastOpenedConversationId)
  );
}

export function isStorageStatus(value: unknown): value is StorageStatus {
  return (
    isRecord(value) &&
    typeof value.available === 'boolean' &&
    optionalString(value.databasePath) &&
    (value.schemaVersion === undefined || typeof value.schemaVersion === 'number') &&
    (value.error === undefined || isStorageError(value.error))
  );
}

export function isPrepareGenerationResponse(value: unknown): value is PrepareGenerationResponse {
  return (
    isRecord(value) &&
    isConversationSummary(value.conversation) &&
    isStoredMessage(value.userMessage) &&
    isStoredMessage(value.assistantMessage)
  );
}

export function isRetentionCleanupResult(value: unknown): value is RetentionCleanupResult {
  return isRecord(value) && typeof value.removedConversations === 'number';
}

export function isDeleteAllResult(value: unknown): value is DeleteAllResult {
  return isRecord(value) && typeof value.deletedConversations === 'number';
}

export function isExportResult(value: unknown): value is ExportResult {
  return (
    isRecord(value) &&
    typeof value.exportedConversations === 'number' &&
    typeof value.filePath === 'string'
  );
}

function isStoredMessage(value: unknown): value is StoredMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.conversationId === 'string' &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    messageStatuses.has(value.status as StoredMessageStatus) &&
    optionalString(value.modelName) &&
    optionalString(value.requestId) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    optionalString(value.completedAt) &&
    optionalString(value.errorCode)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

const retentionPolicies = new Set<RetentionPolicy>([
  'keep_until_delete',
  'delete_after_30_days',
  'delete_after_90_days',
]);

const messageStatuses = new Set<StoredMessageStatus>([
  'completed',
  'streaming',
  'cancelled',
  'failed',
  'interrupted',
]);

const storageErrorCodes = new Set<StorageErrorCode>([
  'database_unavailable',
  'migration_failed',
  'invalid_stored_data',
  'conversation_not_found',
  'message_not_found',
  'write_failed',
  'read_failed',
  'export_failed',
  'deletion_failed',
  'retention_cleanup_failed',
  'invalid_frontend_request',
]);
