import type { ChatMessage } from '../local-ai/types';
import {
  defaultJournalPreferences,
  journalKinds,
  journalModes,
  journalSourceKinds,
  journalStatuses,
  type DeleteAllJournalResult,
  type DevelopmentJournalFixtureResult,
  type JournalDiagnostics,
  type JournalEntry,
  type JournalEntryDraft,
  type JournalEntrySummary,
  type JournalEntryUpdate,
  type JournalExportResult,
  type JournalKind,
  type JournalListOptions,
  type JournalMode,
  type JournalPreferences,
  type JournalSourceKind,
  type JournalStatus,
} from '../journal/types';
import {
  defaultMemoryPreferences,
  memoryApprovalModes,
  memoryCategories,
  memorySensitivities,
  memoryStatuses,
  type DeleteAllMemoriesResult,
  type DevelopmentMemoryFixtureResult,
  type Memory,
  type MemoryApprovalMode,
  type MemoryCategory,
  type MemoryDiagnostics,
  type MemoryDraft,
  type MemoryExportResult,
  type MemoryListOptions,
  type MemoryPreferences,
  type MemorySensitivity,
  type MemorySourceKind,
  type MemoryStatus,
  type MemoryUsageRecord,
  type MemoryUsageRequest,
  type RetrievedMemory,
} from '../memory/types';

export type {
  DeleteAllJournalResult,
  DeleteAllMemoriesResult,
  DevelopmentJournalFixtureResult,
  DevelopmentMemoryFixtureResult,
  JournalDiagnostics,
  JournalEntry,
  JournalEntryDraft,
  JournalEntrySummary,
  JournalEntryUpdate,
  JournalExportResult,
  JournalKind,
  JournalListOptions,
  JournalMode,
  JournalPreferences,
  JournalSourceKind,
  JournalStatus,
  Memory,
  MemoryApprovalMode,
  MemoryCategory,
  MemoryDiagnostics,
  MemoryDraft,
  MemoryExportResult,
  MemoryListOptions,
  MemoryPreferences,
  MemorySensitivity,
  MemorySourceKind,
  MemoryStatus,
  MemoryUsageRecord,
  MemoryUsageRequest,
  RetrievedMemory,
};

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

export interface StorageDiagnostics {
  available: boolean;
  databaseFileName: string;
  databaseLocationSummary?: string;
  schemaVersion?: number;
  conversationCount: number;
  activeConversationCount: number;
  archivedConversationCount: number;
  messageCount: number;
  lastSuccessfulRetentionCleanupAt?: string;
  error?: StorageError;
}

export type RetentionPolicy = 'keep_until_delete' | 'delete_after_30_days' | 'delete_after_90_days';

export type CompanionPlacementMode = 'free' | 'dock_left' | 'dock_right' | 'taskbar_perch';

export interface CompanionFreePosition {
  x: number;
  y: number;
}

export interface CompanionPreferences {
  buddyVisible: boolean;
  buddyAlwaysOnTop: boolean;
  placementMode: CompanionPlacementMode;
  freePosition?: CompanionFreePosition;
  ambientAnimationsEnabled: boolean;
  reducedMovementEnabled: boolean;
  sleepAfterInactivitySeconds: number;
  proactiveCheckinsEnabled: boolean;
  proactiveCheckinCooldownMinutes: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  doNotDisturb: boolean;
  globalShortcutEnabled: boolean;
  launchAtLogin: boolean;
  openCompanionHomeAtStartup: boolean;
  bubbleWidth: number;
}

export interface AppSettings {
  selectedLocalModel?: string;
  ambientAnimationsEnabled: boolean;
  conversationRetentionPolicy: RetentionPolicy;
  lastOpenedConversationId?: string;
  activeHyperliquidAccountId?: string;
  companionPreferences: CompanionPreferences;
  memoryPreferences: MemoryPreferences;
  journalPreferences: JournalPreferences;
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
  fileName: string;
}

export interface DevelopmentFixtureResult {
  conversationId: string;
  assistantMessageId: string;
}

export function storedMessageToChatMessage(message: StoredMessage): ChatMessage {
  const statusNote = messageStatusNote(message);
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    status: message.status,
    ...(statusNote ? { statusNote } : {}),
  };
}

export function decorateStoredMessageContent(message: StoredMessage): string {
  return message.content;
}

export function messageStatusNote(
  message: Pick<StoredMessage, 'role' | 'status'>,
): string | undefined {
  if (message.role !== 'assistant') {
    return undefined;
  }
  switch (message.status) {
    case 'streaming':
      return 'Generation is still in progress.';
    case 'cancelled':
      return 'You stopped this generation.';
    case 'failed':
      return 'Generation failed. Technical details are not shown in the conversation.';
    case 'interrupted':
      return 'The app closed or generation stopped unexpectedly.';
    case 'completed':
      return undefined;
  }
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
    optionalString(value.lastOpenedConversationId) &&
    optionalString(value.activeHyperliquidAccountId) &&
    isCompanionPreferences(value.companionPreferences) &&
    isMemoryPreferences(value.memoryPreferences) &&
    isJournalPreferences(value.journalPreferences)
  );
}

export function isCompanionPreferences(value: unknown): value is CompanionPreferences {
  return (
    isRecord(value) &&
    typeof value.buddyVisible === 'boolean' &&
    typeof value.buddyAlwaysOnTop === 'boolean' &&
    companionPlacementModes.has(value.placementMode as CompanionPlacementMode) &&
    (value.freePosition === undefined || isCompanionFreePosition(value.freePosition)) &&
    typeof value.ambientAnimationsEnabled === 'boolean' &&
    typeof value.reducedMovementEnabled === 'boolean' &&
    isBoundedNumber(value.sleepAfterInactivitySeconds, 60, 86_400) &&
    typeof value.proactiveCheckinsEnabled === 'boolean' &&
    isBoundedNumber(value.proactiveCheckinCooldownMinutes, 15, 1_440) &&
    typeof value.quietHoursEnabled === 'boolean' &&
    isClockTime(value.quietHoursStart) &&
    isClockTime(value.quietHoursEnd) &&
    typeof value.doNotDisturb === 'boolean' &&
    typeof value.globalShortcutEnabled === 'boolean' &&
    typeof value.launchAtLogin === 'boolean' &&
    typeof value.openCompanionHomeAtStartup === 'boolean' &&
    isBoundedNumber(value.bubbleWidth, 280, 520)
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

export function isStorageDiagnostics(value: unknown): value is StorageDiagnostics {
  return (
    isRecord(value) &&
    typeof value.available === 'boolean' &&
    typeof value.databaseFileName === 'string' &&
    optionalString(value.databaseLocationSummary) &&
    (value.schemaVersion === undefined || typeof value.schemaVersion === 'number') &&
    typeof value.conversationCount === 'number' &&
    typeof value.activeConversationCount === 'number' &&
    typeof value.archivedConversationCount === 'number' &&
    typeof value.messageCount === 'number' &&
    optionalString(value.lastSuccessfulRetentionCleanupAt) &&
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
    typeof value.filePath === 'string' &&
    typeof value.fileName === 'string'
  );
}

export function isDevelopmentFixtureResult(value: unknown): value is DevelopmentFixtureResult {
  return (
    isRecord(value) &&
    typeof value.conversationId === 'string' &&
    typeof value.assistantMessageId === 'string'
  );
}

export function isMemoryPreferences(value: unknown): value is MemoryPreferences {
  return (
    isRecord(value) &&
    typeof value.memoryEnabled === 'boolean' &&
    memoryApprovalModes.has(value.memoryApprovalMode as MemoryApprovalMode) &&
    typeof value.allowPersonalMemories === 'boolean' &&
    typeof value.allowSensitiveMemories === 'boolean' &&
    typeof value.showMemoryUsedIndicator === 'boolean' &&
    typeof value.memoryCandidateNotifications === 'boolean' &&
    isBoundedNumber(value.temporaryMemoryDefaultExpiryDays, 1, 365) &&
    typeof value.useMemoriesInTemporaryChat === 'boolean'
  );
}

export function normalizeMemoryPreferences(value: unknown): MemoryPreferences {
  return isMemoryPreferences(value) ? value : defaultMemoryPreferences;
}

export function isJournalPreferences(value: unknown): value is JournalPreferences {
  return (
    isRecord(value) &&
    typeof value.journalingEnabled === 'boolean' &&
    journalModes.has(value.defaultJournalMode as JournalMode) &&
    typeof value.defaultEntryPrivate === 'boolean' &&
    typeof value.allowMemoryCandidatesFromJournal === 'boolean' &&
    typeof value.dailyCheckInEnabled === 'boolean' &&
    optionalString(value.dailyCheckInTime) &&
    typeof value.eveningReviewEnabled === 'boolean' &&
    optionalString(value.eveningReviewTime) &&
    isBoundedNumber(value.journalCheckInCooldownMinutes, 15, 1_440) &&
    typeof value.showMoodPrompt === 'boolean' &&
    typeof value.showEnergyPrompt === 'boolean'
  );
}

export function normalizeJournalPreferences(value: unknown): JournalPreferences {
  return isJournalPreferences(value) ? value : defaultJournalPreferences;
}

export function isMemory(value: unknown): value is Memory {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    memoryCategories.has(value.category as MemoryCategory) &&
    typeof value.content === 'string' &&
    typeof value.normalizedContent === 'string' &&
    memoryStatuses.has(value.status as MemoryStatus) &&
    isMemorySourceKind(value.sourceKind) &&
    optionalString(value.sourceConversationId) &&
    optionalString(value.sourceMessageId) &&
    typeof value.confidence === 'number' &&
    typeof value.importance === 'number' &&
    memorySensitivities.has(value.sensitivity as MemorySensitivity) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    optionalString(value.confirmedAt) &&
    optionalString(value.lastUsedAt) &&
    typeof value.useCount === 'number' &&
    optionalString(value.expiresAt) &&
    optionalString(value.supersedesMemoryId)
  );
}

export function isRetrievedMemory(value: unknown): value is RetrievedMemory {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    memoryCategories.has(value.category as MemoryCategory) &&
    typeof value.content === 'string' &&
    memorySensitivities.has(value.sensitivity as MemorySensitivity) &&
    typeof value.score === 'number' &&
    Array.isArray(value.matchReasons) &&
    value.matchReasons.every((reason) => typeof reason === 'string')
  );
}

export function isMemoryUsageRecord(value: unknown): value is MemoryUsageRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.memoryId === 'string' &&
    typeof value.conversationId === 'string' &&
    optionalString(value.assistantMessageId) &&
    typeof value.usedAt === 'string' &&
    typeof value.reasonCode === 'string'
  );
}

export function isJournalEntry(value: unknown): value is JournalEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    journalKinds.has(value.kind as JournalKind) &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    optionalString(value.summary) &&
    journalStatuses.has(value.status as JournalStatus) &&
    journalSourceKinds.has(value.sourceKind as JournalSourceKind) &&
    optionalString(value.sourceConversationId) &&
    optionalString(value.sourceMessageId) &&
    optionalRating(value.mood) &&
    optionalRating(value.energy) &&
    optionalRating(value.stress) &&
    optionalRating(value.confidence) &&
    typeof value.occurredAt === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    optionalString(value.completedAt) &&
    typeof value.allowMemoryCandidates === 'boolean' &&
    typeof value.isPrivate === 'boolean' &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string')
  );
}

export function isJournalEntrySummary(value: unknown): value is JournalEntrySummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    journalKinds.has(value.kind as JournalKind) &&
    typeof value.title === 'string' &&
    typeof value.preview === 'string' &&
    optionalString(value.summary) &&
    journalStatuses.has(value.status as JournalStatus) &&
    typeof value.occurredAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.isPrivate === 'boolean' &&
    typeof value.allowMemoryCandidates === 'boolean' &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    optionalRating(value.mood) &&
    optionalRating(value.energy)
  );
}

export function isJournalDiagnostics(value: unknown): value is JournalDiagnostics {
  return (
    isRecord(value) &&
    typeof value.totalCount === 'number' &&
    typeof value.draftCount === 'number' &&
    typeof value.completedCount === 'number' &&
    typeof value.discardedCount === 'number' &&
    typeof value.privateCount === 'number' &&
    typeof value.fixtureCount === 'number' &&
    typeof value.tagCount === 'number' &&
    typeof value.ftsAvailable === 'boolean'
  );
}

export function isDeleteAllJournalResult(value: unknown): value is DeleteAllJournalResult {
  return isRecord(value) && typeof value.deletedEntries === 'number';
}

export function isJournalExportResult(value: unknown): value is JournalExportResult {
  return (
    isRecord(value) &&
    typeof value.exportedEntries === 'number' &&
    typeof value.filePath === 'string' &&
    typeof value.fileName === 'string'
  );
}

export function isDevelopmentJournalFixtureResult(
  value: unknown,
): value is DevelopmentJournalFixtureResult {
  return (
    isRecord(value) &&
    typeof value.createdEntries === 'number' &&
    typeof value.deletedEntries === 'number'
  );
}

export function isMemoryDiagnostics(value: unknown): value is MemoryDiagnostics {
  return (
    isRecord(value) &&
    typeof value.totalCount === 'number' &&
    typeof value.proposedCount === 'number' &&
    typeof value.confirmedCount === 'number' &&
    typeof value.rejectedCount === 'number' &&
    typeof value.expiredCount === 'number' &&
    typeof value.supersededCount === 'number' &&
    typeof value.sensitiveCount === 'number' &&
    typeof value.ftsAvailable === 'boolean' &&
    typeof value.fixtureCount === 'number'
  );
}

export function isDeleteAllMemoriesResult(value: unknown): value is DeleteAllMemoriesResult {
  return isRecord(value) && typeof value.deletedMemories === 'number';
}

export function isDevelopmentMemoryFixtureResult(
  value: unknown,
): value is DevelopmentMemoryFixtureResult {
  return (
    isRecord(value) &&
    typeof value.createdMemories === 'number' &&
    typeof value.deletedMemories === 'number'
  );
}

export function isMemoryExportResult(value: unknown): value is MemoryExportResult {
  return (
    isRecord(value) &&
    typeof value.exportedMemories === 'number' &&
    typeof value.filePath === 'string' &&
    typeof value.fileName === 'string'
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

function isCompanionFreePosition(value: unknown): value is CompanionFreePosition {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isInteger(value.x) &&
    typeof value.y === 'number' &&
    Number.isInteger(value.y)
  );
}

function isMemorySourceKind(value: unknown): value is MemorySourceKind {
  return (
    value === 'user_explicit' ||
    value === 'model_proposed' ||
    value === 'user_created' ||
    value === 'system_observation'
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalRating(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5)
  );
}

function isBoundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isClockTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }
  const parts = value.split(':').map(Number);
  const hour = parts[0];
  const minute = parts[1];
  return (
    typeof hour === 'number' &&
    typeof minute === 'number' &&
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour <= 23 &&
    minute <= 59
  );
}

const retentionPolicies = new Set<RetentionPolicy>([
  'keep_until_delete',
  'delete_after_30_days',
  'delete_after_90_days',
]);

const companionPlacementModes = new Set<CompanionPlacementMode>([
  'free',
  'dock_left',
  'dock_right',
  'taskbar_perch',
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
