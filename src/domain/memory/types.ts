export type MemoryCategory =
  | 'preference'
  | 'goal'
  | 'personal_rule'
  | 'communication_style'
  | 'routine'
  | 'project'
  | 'trading_profile'
  | 'risk_rule'
  | 'emotional_trigger'
  | 'important_context'
  | 'temporary_context'
  | 'other';

export type MemoryStatus = 'proposed' | 'confirmed' | 'rejected' | 'expired' | 'superseded';

export type MemorySourceKind =
  | 'user_explicit'
  | 'model_proposed'
  | 'user_created'
  | 'system_observation';

export type MemorySensitivity = 'ordinary' | 'personal' | 'sensitive' | 'prohibited';

export type MemoryApprovalMode = 'ask_every_time' | 'auto_save_ordinary' | 'manual_only';

export interface MemoryPreferences {
  memoryEnabled: boolean;
  memoryApprovalMode: MemoryApprovalMode;
  allowPersonalMemories: boolean;
  allowSensitiveMemories: boolean;
  showMemoryUsedIndicator: boolean;
  memoryCandidateNotifications: boolean;
  temporaryMemoryDefaultExpiryDays: number;
  useMemoriesInTemporaryChat: boolean;
}

export interface Memory {
  id: string;
  category: MemoryCategory;
  content: string;
  normalizedContent: string;
  status: MemoryStatus;
  sourceKind: MemorySourceKind;
  sourceConversationId?: string | undefined;
  sourceMessageId?: string | undefined;
  confidence: number;
  importance: number;
  sensitivity: MemorySensitivity;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | undefined;
  lastUsedAt?: string | undefined;
  useCount: number;
  expiresAt?: string | undefined;
  supersedesMemoryId?: string | undefined;
}

export interface MemoryDraft {
  category: MemoryCategory;
  content: string;
  status: MemoryStatus;
  sourceKind: MemorySourceKind;
  sourceConversationId?: string | undefined;
  sourceMessageId?: string | undefined;
  confidence: number;
  importance: number;
  sensitivity: MemorySensitivity;
  expiresAt?: string | undefined;
  supersedesMemoryId?: string | undefined;
}

export interface MemoryListOptions {
  status?: MemoryStatus | undefined;
  category?: MemoryCategory | undefined;
  sensitivity?: MemorySensitivity | undefined;
  query?: string | undefined;
  limit: number;
}

export interface RetrievedMemory {
  id: string;
  category: MemoryCategory;
  content: string;
  sensitivity: MemorySensitivity;
  score: number;
  matchReasons: string[];
}

export interface MemoryUsageRecord {
  id: string;
  memoryId: string;
  conversationId: string;
  assistantMessageId?: string | undefined;
  usedAt: string;
  reasonCode: string;
}

export interface MemoryUsageRequest {
  memoryIds: string[];
  conversationId: string;
  assistantMessageId?: string | undefined;
  reasonCode: string;
}

export interface DeleteAllMemoriesResult {
  deletedMemories: number;
}

export interface MemoryExportResult {
  exportedMemories: number;
  filePath: string;
  fileName: string;
}

export interface MemoryExtractionDecision {
  shouldExtract: boolean;
  reason:
    | 'explicit_request'
    | 'durable_statement'
    | 'goal_or_rule'
    | 'temporary_context'
    | 'not_memory_worthy'
    | 'temporary_chat'
    | 'memory_disabled'
    | 'secret_detected'
    | 'user_opt_out';
}

export interface ProposedMemoryCandidate {
  category: MemoryCategory;
  content: string;
  confidence: number;
  importance: number;
  sensitivity: MemorySensitivity;
  expiry?:
    | {
        kind: 'none' | 'date' | 'days';
        value?: string | number;
      }
    | undefined;
  action: 'create' | 'update_existing' | 'ignore';
  existingMemoryId?: string | undefined;
}

export const memoryCategories = new Set<MemoryCategory>([
  'preference',
  'goal',
  'personal_rule',
  'communication_style',
  'routine',
  'project',
  'trading_profile',
  'risk_rule',
  'emotional_trigger',
  'important_context',
  'temporary_context',
  'other',
]);

export const memoryStatuses = new Set<MemoryStatus>([
  'proposed',
  'confirmed',
  'rejected',
  'expired',
  'superseded',
]);

export const memorySensitivities = new Set<MemorySensitivity>([
  'ordinary',
  'personal',
  'sensitive',
  'prohibited',
]);

export const memoryApprovalModes = new Set<MemoryApprovalMode>([
  'ask_every_time',
  'auto_save_ordinary',
  'manual_only',
]);

export const defaultMemoryPreferences: MemoryPreferences = {
  memoryEnabled: true,
  memoryApprovalMode: 'ask_every_time',
  allowPersonalMemories: true,
  allowSensitiveMemories: false,
  showMemoryUsedIndicator: true,
  memoryCandidateNotifications: true,
  temporaryMemoryDefaultExpiryDays: 7,
  useMemoriesInTemporaryChat: false,
};
