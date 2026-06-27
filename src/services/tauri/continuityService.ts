import { invoke } from '@tauri-apps/api/core';
import {
  isConsolidationJobRecord,
  isContinuityRetrievalResult,
  isContinuitySnapshot,
  isEntityRecord,
  isEpisodeRecord,
  type ConsolidationJobRecord,
  type ContinuityRetrievalItem,
  type ContinuityRetrievalResult,
  type ContinuitySnapshot,
  type EntityRecord,
  type EpisodeRecord,
  type EpisodeStatus,
} from '../../domain/continuity/types';
import { normalizeStorageError, StorageException } from '../../domain/storage/types';

export interface ContinuityService {
  snapshot(): Promise<ContinuitySnapshot>;
  enqueue(conversationId: string): Promise<ConsolidationJobRecord>;
  consolidateNow(conversationId: string): Promise<ConsolidationJobRecord | null>;
  retrieve(options: {
    query: string;
    limit?: number;
    includeSensitive?: boolean;
  }): Promise<ContinuityRetrievalResult>;
  recordUsage(options: {
    conversationId: string;
    assistantMessageId?: string;
    items: ContinuityRetrievalItem[];
  }): Promise<void>;
  updateEpisode(options: {
    episodeId: string;
    title: string;
    summary: string;
    status: EpisodeStatus;
  }): Promise<EpisodeRecord>;
  deleteEpisode(episodeId: string): Promise<void>;
  updateEntity(options: {
    entityId: string;
    canonicalName: string;
    aliases: string[];
    status: EntityRecord['status'];
  }): Promise<EntityRecord>;
  deleteEntity(entityId: string): Promise<void>;
  deleteSummary(summaryId: string): Promise<void>;
  deleteCurrentLifeItem(contextId: string): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  retryJob(jobId: string): Promise<ConsolidationJobRecord>;
  reembed(): Promise<number>;
  deleteAll(): Promise<number>;
}

export const tauriContinuityService: ContinuityService = {
  async snapshot() {
    return invokeChecked('get_continuity_snapshot', undefined, isContinuitySnapshot);
  },
  async enqueue(conversationId) {
    return invokeChecked(
      'enqueue_continuity_consolidation',
      { conversationId },
      isConsolidationJobRecord,
    );
  },
  async consolidateNow(conversationId) {
    const value = await invokeWrapped<unknown>('consolidate_continuity_now', {
      conversationId,
    });
    if (value === null || isConsolidationJobRecord(value)) {
      return value;
    }
    throw invalidResponse('Invalid consolidation result.');
  },
  async retrieve({ query, limit = 8, includeSensitive = false }) {
    return invokeChecked(
      'retrieve_continuity',
      { query, limit, includeSensitive },
      isContinuityRetrievalResult,
    );
  },
  async recordUsage({ conversationId, assistantMessageId, items }) {
    await invokeWrapped('record_continuity_retrieval_usage', {
      conversationId,
      assistantMessageId,
      items,
    });
  },
  async updateEpisode({ episodeId, title, summary, status }) {
    return invokeChecked(
      'update_continuity_episode',
      { episodeId, title, summary, status },
      isEpisodeRecord,
    );
  },
  async deleteEpisode(episodeId) {
    await invokeWrapped('delete_continuity_episode', { episodeId });
  },
  async updateEntity({ entityId, canonicalName, aliases, status }) {
    return invokeChecked(
      'update_continuity_entity',
      { entityId, canonicalName, aliases, status },
      isEntityRecord,
    );
  },
  async deleteEntity(entityId) {
    await invokeWrapped('delete_continuity_entity', { entityId });
  },
  async deleteSummary(summaryId) {
    await invokeWrapped('delete_continuity_summary', { summaryId });
  },
  async deleteCurrentLifeItem(contextId) {
    await invokeWrapped('delete_current_life_item', { contextId });
  },
  async cancelJob(jobId) {
    await invokeWrapped('cancel_continuity_job', { jobId });
  },
  async retryJob(jobId) {
    return invokeChecked('retry_continuity_job', { jobId }, isConsolidationJobRecord);
  },
  async reembed() {
    const value = await invokeWrapped<unknown>('reembed_continuity');
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    throw invalidResponse('Invalid re-embedding result.');
  },
  async deleteAll() {
    const value = await invokeWrapped<unknown>('delete_all_continuity_data');
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    throw invalidResponse('Invalid continuity deletion result.');
  },
};

async function invokeChecked<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  guard: (value: unknown) => value is T,
): Promise<T> {
  const value = await invokeWrapped<unknown>(command, args);
  if (!guard(value)) {
    throw invalidResponse(`Invalid ${command} response.`);
  }
  return value;
}

async function invokeWrapped<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new StorageException(normalizeStorageError(error));
  }
}

function invalidResponse(message: string): StorageException {
  return new StorageException(
    normalizeStorageError({
      code: 'invalid_stored_data',
      userMessage: 'Trading Buddy received invalid local continuity data.',
      technicalMessage: message,
      retryable: false,
    }),
  );
}
