import { invoke } from '@tauri-apps/api/core';
import {
  isAppSettings,
  isConversationDetail,
  isConversationSummary,
  isDeleteAllResult,
  isExportResult,
  isPrepareGenerationResponse,
  isRetentionCleanupResult,
  isStorageStatus,
  normalizeStorageError,
  StorageException,
  type AppSettings,
  type AssistantMessageFailure,
  type AssistantMessageUpdate,
  type ConversationDetail,
  type ConversationSummary,
  type DeleteAllResult,
  type ExportResult,
  type PrepareGenerationRequest,
  type PrepareGenerationResponse,
  type RetentionCleanupResult,
  type RetentionPolicy,
  type StorageStatus,
} from '../../domain/storage/types';

export interface StorageService {
  status(): Promise<StorageStatus>;
  getSettings(): Promise<AppSettings>;
  setSelectedModel(modelName: string | null): Promise<AppSettings>;
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
}

export const tauriStorageService: StorageService = {
  async status() {
    return invokeChecked('get_storage_status', undefined, isStorageStatus);
  },

  async getSettings() {
    return invokeChecked('get_app_settings', undefined, isAppSettings);
  },

  async setSelectedModel(modelName) {
    return invokeChecked('set_selected_local_model', { modelName }, isAppSettings);
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
