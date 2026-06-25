import { invoke } from '@tauri-apps/api/core';
import {
  isAppSettings,
  isConversationDetail,
  isConversationSummary,
  isDeleteAllResult,
  isDeleteAllJournalResult,
  isDeleteAllMemoriesResult,
  isExportResult,
  isDevelopmentFixtureResult,
  isDevelopmentJournalFixtureResult,
  isDevelopmentMemoryFixtureResult,
  isJournalDiagnostics,
  isJournalEntry,
  isJournalEntrySummary,
  isJournalExportResult,
  isMemory,
  isMemoryDiagnostics,
  isMemoryExportResult,
  isMemoryUsageRecord,
  isPrepareGenerationResponse,
  isRetentionCleanupResult,
  isRetrievedMemory,
  isStorageDiagnostics,
  isStorageStatus,
  normalizeStorageError,
  StorageException,
  type AppSettings,
  type AssistantMessageFailure,
  type AssistantMessageUpdate,
  type CompanionPreferences,
  type ConversationDetail,
  type ConversationSummary,
  type DeleteAllJournalResult,
  type DeleteAllMemoriesResult,
  type DeleteAllResult,
  type DevelopmentFixtureResult,
  type DevelopmentJournalFixtureResult,
  type DevelopmentMemoryFixtureResult,
  type ExportResult,
  type JournalDiagnostics,
  type JournalEntry,
  type JournalEntryDraft,
  type JournalEntrySummary,
  type JournalEntryUpdate,
  type JournalExportResult,
  type JournalListOptions,
  type JournalPreferences,
  type Memory,
  type MemoryCategory,
  type MemoryDiagnostics,
  type MemoryDraft,
  type MemoryExportResult,
  type MemoryListOptions,
  type MemoryPreferences,
  type MemorySensitivity,
  type MemoryUsageRecord,
  type MemoryUsageRequest,
  type PrepareGenerationRequest,
  type PrepareGenerationResponse,
  type RetrievedMemory,
  type RetentionCleanupResult,
  type RetentionPolicy,
  type StorageStatus,
  type StorageDiagnostics,
} from '../../domain/storage/types';

export interface StorageService {
  status(): Promise<StorageStatus>;
  diagnostics(): Promise<StorageDiagnostics>;
  getSettings(): Promise<AppSettings>;
  setSelectedModel(modelName: string | null): Promise<AppSettings>;
  setCompanionPreferences(preferences: CompanionPreferences): Promise<AppSettings>;
  setMemoryPreferences(preferences: MemoryPreferences): Promise<AppSettings>;
  setJournalPreferences(preferences: JournalPreferences): Promise<AppSettings>;
  setRetentionPolicy(policy: RetentionPolicy): Promise<RetentionCleanupResult>;
  applyRetentionCleanup(): Promise<RetentionCleanupResult>;
  listConversations(options: {
    archived: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ConversationSummary[]>;
  getConversation(conversationId: string): Promise<ConversationDetail>;
  setLastOpenedConversation(conversationId: string | null): Promise<void>;
  getLastOpenedConversation(): Promise<string | null>;
  prepareGeneration(request: PrepareGenerationRequest): Promise<PrepareGenerationResponse>;
  checkpointAssistant(update: AssistantMessageUpdate): Promise<void>;
  completeAssistant(update: AssistantMessageUpdate): Promise<void>;
  cancelAssistant(update: AssistantMessageUpdate): Promise<void>;
  failAssistant(update: AssistantMessageFailure): Promise<void>;
  renameConversation(conversationId: string, title: string): Promise<ConversationSummary>;
  archiveConversation(conversationId: string): Promise<ConversationSummary>;
  restoreConversation(conversationId: string): Promise<ConversationSummary>;
  deleteConversation(conversationId: string): Promise<void>;
  deleteAllConversationData(): Promise<DeleteAllResult>;
  exportConversations(): Promise<ExportResult | null>;
  createMemory(draft: MemoryDraft): Promise<Memory>;
  listMemories(options: MemoryListOptions): Promise<Memory[]>;
  confirmMemory(memoryId: string): Promise<Memory>;
  rejectMemory(memoryId: string): Promise<Memory>;
  restoreMemory(memoryId: string): Promise<Memory>;
  updateMemoryContent(options: {
    memoryId: string;
    content: string;
    category: MemoryCategory;
    sensitivity: MemorySensitivity;
    expiresAt?: string | undefined;
  }): Promise<Memory>;
  updateMemoryExpiry(options: {
    memoryId: string;
    expiresAt?: string | undefined;
  }): Promise<Memory>;
  supersedeMemory(options: { previousMemoryId: string; replacement: MemoryDraft }): Promise<Memory>;
  deleteMemory(memoryId: string): Promise<void>;
  deleteAllMemories(): Promise<DeleteAllMemoriesResult>;
  cleanupExpiredMemories(): Promise<number>;
  retrieveMemories(options: {
    query: string;
    limit?: number;
    includeSensitive?: boolean;
  }): Promise<RetrievedMemory[]>;
  recordMemoryUsage(request: MemoryUsageRequest): Promise<void>;
  listMemoryUsageRecords(options: {
    memoryId?: string | undefined;
    limit?: number;
  }): Promise<MemoryUsageRecord[]>;
  exportMemories(includeSensitive: boolean): Promise<MemoryExportResult | null>;
  createJournalEntry(draft: JournalEntryDraft): Promise<JournalEntry>;
  updateJournalEntry(update: JournalEntryUpdate): Promise<JournalEntry>;
  getJournalEntry(entryId: string): Promise<JournalEntry>;
  listJournalEntries(options: JournalListOptions): Promise<JournalEntrySummary[]>;
  deleteJournalEntry(entryId: string): Promise<void>;
  deleteAllJournalEntries(): Promise<DeleteAllJournalResult>;
  exportJournalJson(includePrivate: boolean): Promise<JournalExportResult | null>;
  exportJournalMarkdown(includePrivate: boolean): Promise<JournalExportResult | null>;
  getJournalDiagnostics(): Promise<JournalDiagnostics>;
  createDevelopmentJournalFixtures(count: number): Promise<DevelopmentJournalFixtureResult>;
  deleteDevelopmentJournalFixtures(): Promise<DevelopmentJournalFixtureResult>;
  getMemoryDiagnostics(): Promise<MemoryDiagnostics>;
  createDevelopmentMemoryFixtures(count: number): Promise<DevelopmentMemoryFixtureResult>;
  deleteDevelopmentMemoryFixtures(): Promise<DevelopmentMemoryFixtureResult>;
  createDevelopmentInterruptedFixture(): Promise<DevelopmentFixtureResult>;
}

export const tauriStorageService: StorageService = {
  async status() {
    return invokeChecked('get_storage_status', undefined, isStorageStatus);
  },

  async diagnostics() {
    return invokeChecked('get_storage_diagnostics', undefined, isStorageDiagnostics);
  },

  async getSettings() {
    return invokeChecked('get_app_settings', undefined, isAppSettings);
  },

  async setSelectedModel(modelName) {
    return invokeChecked('set_selected_local_model', { modelName }, isAppSettings);
  },

  async setCompanionPreferences(preferences) {
    return invokeChecked('set_companion_preferences', { preferences }, isAppSettings);
  },

  async setMemoryPreferences(preferences) {
    return invokeChecked('set_memory_preferences', { preferences }, isAppSettings);
  },

  async setJournalPreferences(preferences) {
    return invokeChecked('set_journal_preferences', { preferences }, isAppSettings);
  },

  async setRetentionPolicy(policy) {
    return invokeChecked('set_conversation_retention_policy', { policy }, isRetentionCleanupResult);
  },

  async applyRetentionCleanup() {
    return invokeChecked('apply_retention_cleanup', undefined, isRetentionCleanupResult);
  },

  async listConversations({ archived, limit = 50, offset = 0 }) {
    return invokeChecked(
      'list_conversations',
      { archived, limit, offset },
      (value): value is ConversationSummary[] =>
        Array.isArray(value) && value.every(isConversationSummary),
    );
  },

  async getConversation(conversationId) {
    return invokeChecked('get_conversation', { conversationId }, isConversationDetail);
  },

  async setLastOpenedConversation(conversationId) {
    await invokeWrapped('set_last_opened_conversation', { conversationId });
  },

  async getLastOpenedConversation() {
    const value = await invokeWrapped<unknown>('get_last_opened_conversation');
    if (value === null || typeof value === 'string') {
      return value;
    }
    throw new StorageException(normalizeStorageError('Invalid last-opened conversation response.'));
  },

  async prepareGeneration(request) {
    return invokeChecked('prepare_persistent_generation', { request }, isPrepareGenerationResponse);
  },

  async checkpointAssistant(update) {
    await invokeWrapped('checkpoint_assistant_message', { update });
  },

  async completeAssistant(update) {
    await invokeWrapped('complete_assistant_message', { update });
  },

  async cancelAssistant(update) {
    await invokeWrapped('cancel_assistant_message', { update });
  },

  async failAssistant(update) {
    await invokeWrapped('fail_assistant_message', { update });
  },

  async renameConversation(conversationId, title) {
    return invokeChecked('rename_conversation', { conversationId, title }, isConversationSummary);
  },

  async archiveConversation(conversationId) {
    return invokeChecked('archive_conversation', { conversationId }, isConversationSummary);
  },

  async restoreConversation(conversationId) {
    return invokeChecked('restore_conversation', { conversationId }, isConversationSummary);
  },

  async deleteConversation(conversationId) {
    await invokeWrapped('delete_conversation', { conversationId });
  },

  async deleteAllConversationData() {
    return invokeChecked('delete_all_conversation_data', undefined, isDeleteAllResult);
  },

  async exportConversations() {
    const value = await invokeWrapped<unknown>('export_conversations');
    if (value === null || isExportResult(value)) {
      return value;
    }
    throw new StorageException(normalizeStorageError('Invalid export response.'));
  },

  async createMemory(draft) {
    return invokeChecked('create_memory', { draft }, isMemory);
  },

  async listMemories(options) {
    return invokeChecked(
      'list_memories',
      { options },
      (value): value is Memory[] => Array.isArray(value) && value.every(isMemory),
    );
  },

  async confirmMemory(memoryId) {
    return invokeChecked('confirm_memory', { memoryId }, isMemory);
  },

  async rejectMemory(memoryId) {
    return invokeChecked('reject_memory', { memoryId }, isMemory);
  },

  async restoreMemory(memoryId) {
    return invokeChecked('restore_memory', { memoryId }, isMemory);
  },

  async updateMemoryContent({ memoryId, content, category, sensitivity, expiresAt }) {
    return invokeChecked(
      'update_memory_content',
      { memoryId, content, category, sensitivity, expiresAt },
      isMemory,
    );
  },

  async updateMemoryExpiry({ memoryId, expiresAt }) {
    return invokeChecked('update_memory_expiry', { memoryId, expiresAt }, isMemory);
  },

  async supersedeMemory({ previousMemoryId, replacement }) {
    return invokeChecked('supersede_memory', { previousMemoryId, replacement }, isMemory);
  },

  async deleteMemory(memoryId) {
    await invokeWrapped('delete_memory', { memoryId });
  },

  async deleteAllMemories() {
    return invokeChecked('delete_all_memories', undefined, isDeleteAllMemoriesResult);
  },

  async cleanupExpiredMemories() {
    const value = await invokeWrapped<unknown>('cleanup_expired_memories');
    if (typeof value === 'number') {
      return value;
    }
    throw new StorageException(normalizeStorageError('Invalid expiry cleanup response.'));
  },

  async retrieveMemories({ query, limit = 5, includeSensitive = false }) {
    return invokeChecked(
      'retrieve_memories',
      { query, limit, includeSensitive },
      (value): value is RetrievedMemory[] => Array.isArray(value) && value.every(isRetrievedMemory),
    );
  },

  async recordMemoryUsage(request) {
    await invokeWrapped('record_memory_usage', { request });
  },

  async listMemoryUsageRecords({ memoryId, limit = 50 }) {
    return invokeChecked(
      'list_memory_usage_records',
      { memoryId, limit },
      (value): value is MemoryUsageRecord[] =>
        Array.isArray(value) && value.every(isMemoryUsageRecord),
    );
  },

  async exportMemories(includeSensitive) {
    const value = await invokeWrapped<unknown>('export_memories', { includeSensitive });
    if (value === null || isMemoryExportResult(value)) {
      return value;
    }
    throw new StorageException(normalizeStorageError('Invalid memory export response.'));
  },

  async createJournalEntry(draft) {
    return invokeChecked('create_journal_entry', { draft }, isJournalEntry);
  },

  async updateJournalEntry(update) {
    return invokeChecked('update_journal_entry', { update }, isJournalEntry);
  },

  async getJournalEntry(entryId) {
    return invokeChecked('get_journal_entry', { entryId }, isJournalEntry);
  },

  async listJournalEntries(options) {
    return invokeChecked(
      'list_journal_entries',
      { options },
      (value): value is JournalEntrySummary[] =>
        Array.isArray(value) && value.every(isJournalEntrySummary),
    );
  },

  async deleteJournalEntry(entryId) {
    await invokeWrapped('delete_journal_entry', { entryId });
  },

  async deleteAllJournalEntries() {
    return invokeChecked('delete_all_journal_entries', undefined, isDeleteAllJournalResult);
  },

  async exportJournalJson(includePrivate) {
    const value = await invokeWrapped<unknown>('export_journal_json', { includePrivate });
    if (value === null || isJournalExportResult(value)) {
      return value;
    }
    throw new StorageException(normalizeStorageError('Invalid journal JSON export response.'));
  },

  async exportJournalMarkdown(includePrivate) {
    const value = await invokeWrapped<unknown>('export_journal_markdown', { includePrivate });
    if (value === null || isJournalExportResult(value)) {
      return value;
    }
    throw new StorageException(normalizeStorageError('Invalid journal Markdown export response.'));
  },

  async getJournalDiagnostics() {
    return invokeChecked('get_journal_diagnostics', undefined, isJournalDiagnostics);
  },

  async createDevelopmentJournalFixtures(count) {
    return invokeChecked(
      'create_development_journal_fixtures',
      { count },
      isDevelopmentJournalFixtureResult,
    );
  },

  async deleteDevelopmentJournalFixtures() {
    return invokeChecked(
      'delete_development_journal_fixtures',
      undefined,
      isDevelopmentJournalFixtureResult,
    );
  },

  async getMemoryDiagnostics() {
    return invokeChecked('get_memory_diagnostics', undefined, isMemoryDiagnostics);
  },

  async createDevelopmentMemoryFixtures(count) {
    return invokeChecked(
      'create_development_memory_fixtures',
      { count },
      isDevelopmentMemoryFixtureResult,
    );
  },

  async deleteDevelopmentMemoryFixtures() {
    return invokeChecked(
      'delete_development_memory_fixtures',
      undefined,
      isDevelopmentMemoryFixtureResult,
    );
  },

  async createDevelopmentInterruptedFixture() {
    return invokeChecked(
      'create_development_interrupted_fixture',
      undefined,
      isDevelopmentFixtureResult,
    );
  },
};

async function invokeChecked<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  guard: (value: unknown) => value is T,
): Promise<T> {
  const value = await invokeWrapped<unknown>(command, args);
  if (!guard(value)) {
    throw new StorageException(normalizeStorageError(`Invalid response from ${command}.`));
  }
  return value;
}

async function invokeWrapped<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    ensureTauri();
    return await invoke<T>(command, args);
  } catch (error) {
    throw new StorageException(normalizeStorageError(error));
  }
}

function ensureTauri() {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new StorageException(
      normalizeStorageError({
        code: 'database_unavailable',
        userMessage: 'Conversation storage is available in the desktop application.',
        technicalMessage: 'Tauri runtime is not present in this browser preview.',
        retryable: true,
      }),
    );
  }
}
