import type { MemorySensitivity } from '../memory/types';

export interface ContinuityPreferences {
  conversationCompactionEnabled: boolean;
  semanticMemoryEnabled: boolean;
  consolidationEnabled: boolean;
  automaticOrdinaryLearningEnabled: boolean;
  embeddingModel: string;
  embedSensitiveContent: boolean;
  recentMessageCount: number;
}

export const DEFAULT_CONTINUITY_PREFERENCES: ContinuityPreferences = {
  conversationCompactionEnabled: true,
  semanticMemoryEnabled: true,
  consolidationEnabled: true,
  automaticOrdinaryLearningEnabled: true,
  embeddingModel: 'embeddinggemma:300m',
  embedSensitiveContent: false,
  recentMessageCount: 12,
};

export interface ConversationContinuitySummary {
  userGoals: string[];
  currentTopics: string[];
  importantEvents: string[];
  emotionalContext: string[];
  peopleAndEntities: string[];
  projects: string[];
  decisions: string[];
  unresolvedItems: string[];
  promisesOrFollowUps: string[];
  userCorrections: string[];
  relevantMemoryIds: string[];
  summarizedThroughMessageId: string;
}

export interface ConversationSummaryRecord {
  id: string;
  conversationId: string;
  summaryVersion: number;
  summarizedThroughMessageId: string;
  summary: ConversationContinuitySummary;
  modelProvider: string;
  modelName: string;
  createdAt: string;
  updatedAt: string;
}

export type EpisodeCategory =
  | 'life_event'
  | 'emotional_moment'
  | 'project'
  | 'decision'
  | 'achievement'
  | 'setback'
  | 'shared_activity'
  | 'conversation'
  | 'other';

export type EpisodeStatus =
  | 'proposed'
  | 'confirmed'
  | 'automatic_ordinary'
  | 'rejected'
  | 'superseded'
  | 'deleted';

export interface EpisodeRecord {
  id: string;
  title: string;
  summary: string;
  category: EpisodeCategory;
  occurredAt?: string;
  importance: number;
  emotionalSignificance: number;
  sensitivity: MemorySensitivity;
  status: EpisodeStatus;
  sourceConversationId?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  useCount: number;
  sourceMessageIds: string[];
  entityIds: string[];
}

export type EntityType =
  | 'person'
  | 'pet'
  | 'project'
  | 'company'
  | 'community'
  | 'place'
  | 'product'
  | 'goal'
  | 'idea'
  | 'other';

export interface EntityRecord {
  id: string;
  entityType: EntityType;
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
  sensitivity: MemorySensitivity;
  status: 'proposed' | 'confirmed' | 'rejected' | 'superseded' | 'deleted';
  pinned: boolean;
  firstMentionedAt: string;
  lastMentionedAt: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  useCount: number;
}

export interface CurrentLifeContextRecord {
  id: string;
  category: string;
  content: string;
  status: 'active' | 'resolved' | 'expired' | 'superseded' | 'deleted';
  importance: number;
  sensitivity: MemorySensitivity;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  sourceConversationId?: string;
  sourceMessageId?: string;
  lastUsedAt?: string;
  useCount: number;
}

export interface ConsolidationJobRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'superseded';
  attemptCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastErrorCode?: string;
  nextAttemptAt?: string;
}

export type SemanticMemoryStatus =
  | 'ready'
  | 'embedding_model_missing'
  | 'embedding_model_unavailable'
  | 'lexical_memory_mode'
  | 'reembedding_required';

export type ContinuityRetrievalReason =
  | 'exact_phrase'
  | 'keyword_overlap'
  | 'semantic_similarity'
  | 'entity_match'
  | 'project_match'
  | 'conversation_summary'
  | 'recent_episode'
  | 'current_life_context'
  | 'high_importance'
  | 'user_requested_recall'
  | 'pinned'
  | 'user_corrected'
  | 'repetition_penalty'
  | 'sensitive_excluded'
  | 'expired_excluded';

export interface ContinuityRetrievalItem {
  sourceType: 'memory' | 'conversation_summary' | 'episode' | 'entity' | 'current_life_context';
  sourceId: string;
  title: string;
  content: string;
  sensitivity: MemorySensitivity;
  score: number;
  reasonCodes: ContinuityRetrievalReason[];
  sourceConversationId?: string;
  sourceMessageIds: string[];
  lastUsedAt?: string;
}

export interface ContinuityRetrievalResult {
  items: ContinuityRetrievalItem[];
  semanticStatus: SemanticMemoryStatus;
  queryEmbeddingUsed: boolean;
  candidateCount: number;
}

export interface ContinuitySnapshot {
  summaries: ConversationSummaryRecord[];
  episodes: EpisodeRecord[];
  entities: EntityRecord[];
  currentLifeContext: CurrentLifeContextRecord[];
  jobs: ConsolidationJobRecord[];
  semanticStatus: SemanticMemoryStatus;
  embeddingModel: string;
  embeddingCount: number;
  staleEmbeddingCount: number;
}

const sensitivities = new Set(['ordinary', 'personal', 'sensitive', 'prohibited']);
const episodeCategories = new Set([
  'life_event',
  'emotional_moment',
  'project',
  'decision',
  'achievement',
  'setback',
  'shared_activity',
  'conversation',
  'other',
]);
const episodeStatuses = new Set([
  'proposed',
  'confirmed',
  'automatic_ordinary',
  'rejected',
  'superseded',
  'deleted',
]);
const entityTypes = new Set([
  'person',
  'pet',
  'project',
  'company',
  'community',
  'place',
  'product',
  'goal',
  'idea',
  'other',
]);
const semanticStatuses = new Set([
  'ready',
  'embedding_model_missing',
  'embedding_model_unavailable',
  'lexical_memory_mode',
  'reembedding_required',
]);

export function isContinuityPreferences(value: unknown): value is ContinuityPreferences {
  return (
    isRecord(value) &&
    typeof value.conversationCompactionEnabled === 'boolean' &&
    typeof value.semanticMemoryEnabled === 'boolean' &&
    typeof value.consolidationEnabled === 'boolean' &&
    typeof value.automaticOrdinaryLearningEnabled === 'boolean' &&
    typeof value.embeddingModel === 'string' &&
    value.embeddingModel.length > 0 &&
    value.embeddingModel.length <= 128 &&
    typeof value.embedSensitiveContent === 'boolean' &&
    isFiniteNumber(value.recentMessageCount) &&
    value.recentMessageCount >= 4 &&
    value.recentMessageCount <= 40
  );
}

export function isConversationContinuitySummary(
  value: unknown,
): value is ConversationContinuitySummary {
  return (
    isRecord(value) &&
    boundedStrings(value.userGoals) &&
    boundedStrings(value.currentTopics) &&
    boundedStrings(value.importantEvents) &&
    boundedStrings(value.emotionalContext) &&
    boundedStrings(value.peopleAndEntities) &&
    boundedStrings(value.projects) &&
    boundedStrings(value.decisions) &&
    boundedStrings(value.unresolvedItems) &&
    boundedStrings(value.promisesOrFollowUps) &&
    boundedStrings(value.userCorrections) &&
    boundedStrings(value.relevantMemoryIds) &&
    typeof value.summarizedThroughMessageId === 'string'
  );
}

export function isContinuitySnapshot(value: unknown): value is ContinuitySnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.summaries) &&
    value.summaries.every(isSummaryRecord) &&
    Array.isArray(value.episodes) &&
    value.episodes.every(isEpisode) &&
    Array.isArray(value.entities) &&
    value.entities.every(isEntity) &&
    Array.isArray(value.currentLifeContext) &&
    value.currentLifeContext.every(isCurrentLife) &&
    Array.isArray(value.jobs) &&
    value.jobs.every(isJob) &&
    typeof value.semanticStatus === 'string' &&
    semanticStatuses.has(value.semanticStatus) &&
    typeof value.embeddingModel === 'string' &&
    isFiniteNumber(value.embeddingCount) &&
    isFiniteNumber(value.staleEmbeddingCount)
  );
}

export function isContinuityRetrievalResult(value: unknown): value is ContinuityRetrievalResult {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isRetrievalItem) &&
    typeof value.semanticStatus === 'string' &&
    semanticStatuses.has(value.semanticStatus) &&
    typeof value.queryEmbeddingUsed === 'boolean' &&
    isFiniteNumber(value.candidateCount)
  );
}

export function isEpisodeRecord(value: unknown): value is EpisodeRecord {
  return isEpisode(value);
}

export function isEntityRecord(value: unknown): value is EntityRecord {
  return isEntity(value);
}

export function isConsolidationJobRecord(value: unknown): value is ConsolidationJobRecord {
  return isJob(value);
}

function isSummaryRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    strings(value, [
      'id',
      'conversationId',
      'summarizedThroughMessageId',
      'modelProvider',
      'modelName',
      'createdAt',
      'updatedAt',
    ]) &&
    isFiniteNumber(value.summaryVersion) &&
    isConversationContinuitySummary(value.summary)
  );
}

function isEpisode(value: unknown): boolean {
  return (
    isRecord(value) &&
    strings(value, ['id', 'title', 'summary', 'createdAt', 'updatedAt']) &&
    typeof value.category === 'string' &&
    episodeCategories.has(value.category) &&
    isOptionalString(value.occurredAt) &&
    isUnit(value.importance) &&
    isUnit(value.emotionalSignificance) &&
    typeof value.sensitivity === 'string' &&
    sensitivities.has(value.sensitivity) &&
    typeof value.status === 'string' &&
    episodeStatuses.has(value.status) &&
    isOptionalString(value.sourceConversationId) &&
    typeof value.pinned === 'boolean' &&
    isOptionalString(value.lastUsedAt) &&
    isFiniteNumber(value.useCount) &&
    stringArray(value.sourceMessageIds) &&
    stringArray(value.entityIds)
  );
}

function isEntity(value: unknown): boolean {
  return (
    isRecord(value) &&
    strings(value, [
      'id',
      'canonicalName',
      'normalizedName',
      'status',
      'firstMentionedAt',
      'lastMentionedAt',
      'createdAt',
      'updatedAt',
    ]) &&
    typeof value.entityType === 'string' &&
    entityTypes.has(value.entityType) &&
    stringArray(value.aliases) &&
    typeof value.sensitivity === 'string' &&
    sensitivities.has(value.sensitivity) &&
    typeof value.pinned === 'boolean' &&
    isOptionalString(value.lastUsedAt) &&
    isFiniteNumber(value.useCount)
  );
}

function isCurrentLife(value: unknown): boolean {
  return (
    isRecord(value) &&
    strings(value, ['id', 'category', 'content', 'status', 'createdAt', 'updatedAt']) &&
    isUnit(value.importance) &&
    typeof value.sensitivity === 'string' &&
    sensitivities.has(value.sensitivity) &&
    typeof value.pinned === 'boolean' &&
    isOptionalString(value.expiresAt) &&
    isOptionalString(value.sourceConversationId) &&
    isOptionalString(value.sourceMessageId) &&
    isOptionalString(value.lastUsedAt) &&
    isFiniteNumber(value.useCount)
  );
}

function isJob(value: unknown): boolean {
  return (
    isRecord(value) &&
    strings(value, ['id', 'sourceType', 'sourceId', 'sourceVersion', 'status', 'createdAt']) &&
    isFiniteNumber(value.attemptCount) &&
    isOptionalString(value.startedAt) &&
    isOptionalString(value.completedAt) &&
    isOptionalString(value.lastErrorCode) &&
    isOptionalString(value.nextAttemptAt)
  );
}

function isRetrievalItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    strings(value, ['sourceType', 'sourceId', 'title', 'content', 'sensitivity']) &&
    sensitivities.has(value.sensitivity as string) &&
    isFiniteNumber(value.score) &&
    stringArray(value.reasonCodes) &&
    isOptionalString(value.sourceConversationId) &&
    stringArray(value.sourceMessageIds) &&
    isOptionalString(value.lastUsedAt)
  );
}

function boundedStrings(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 12 &&
    value.every((item) => typeof item === 'string' && item.length <= 600)
  );
}

function stringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function strings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string');
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isUnit(value: unknown): boolean {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
